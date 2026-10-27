from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import random
import sys
import tempfile
import unittest
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from store import AppError, Store, allocate, money, suggest_transfers
from backup import create_backup


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'test.sqlite3'
        self.store = Store(self.path)
        self.trip = self.store.create_trip({'name': '日本出遊', 'currency': 'TWD', 'members': ['Alice', 'Bob', 'Cara']})
        self.members = [entry['id'] for entry in self.store.get_trip(self.trip)['members']]

    def tearDown(self):
        self.temp.cleanup()

    def expense(self, amount='900', payer=0, shares=None, mode='equal', payments=None):
        return {'title': '晚餐', 'amount': amount, 'spent_on': '2026-10-27', 'category': 'food', 'split_mode': mode, 'client_id': str(uuid.uuid4()), 'payments': payments or [{'member_id': self.members[payer], 'amount': amount}], 'shares': shares or [{'member_id': value, 'value': '1'} for value in self.members]}

    def payment(self, payer, payee, amount):
        return {'payer_id': self.members[payer], 'payee_id': self.members[payee], 'amount': amount, 'paid_on': '2026-10-27', 'client_id': str(uuid.uuid4())}

    def test_money_rejects_rounding_and_invalid_values(self):
        self.assertEqual(money('0.01', 'TWD'), 1)
        self.assertEqual(money('123', 'JPY'), 123)
        for value in ['1.001', '-1', 'NaN', 'Infinity', '1e3', '１', True, 0.1, '100000000000.00']:
            with self.subTest(value=value), self.assertRaises(AppError):
                money(value, 'TWD')
        with self.assertRaises(AppError):
            money('1.1', 'JPY')

    def test_fractional_shares_conserve_every_cent(self):
        self.assertEqual(allocate(10000, [('a', 1), ('b', 1), ('c', 1)]), [3334, 3333, 3333])
        rng = random.Random(2026)
        for _ in range(200):
            total = rng.randrange(1, 1000000000)
            weights = [(str(i), rng.randrange(1, 1001)) for i in range(rng.randrange(1, 50))]
            values = allocate(total, weights)
            self.assertEqual(sum(values), total)
            self.assertTrue(all(value >= 0 for value in values))

    def test_multiple_payers_and_weighted_split(self):
        payload = self.expense('1000', mode='units', payments=[{'member_id': self.members[0], 'amount': '600'}, {'member_id': self.members[1], 'amount': '400'}], shares=[{'member_id': member, 'value': weight} for member, weight in zip(self.members, ['2', '1', '1'])])
        self.store.save_expense(self.trip, payload)
        data = self.store.get_trip(self.trip)
        self.assertEqual([entry['share'] for entry in data['balances']], [50000, 25000, 25000])
        self.assertEqual([entry['net'] for entry in data['balances']], [10000, 15000, -25000])
        self.assertEqual(sum(entry['amount'] for entry in data['expenses'][0]['payments']), data['total'])

    def test_exact_split_and_zero_share(self):
        payload = self.expense('100', mode='exact', shares=[{'member_id': member, 'value': value} for member, value in zip(self.members, ['0', '50', '50'])])
        self.store.save_expense(self.trip, payload)
        self.assertEqual([entry['share'] for entry in self.store.get_trip(self.trip)['balances']], [0, 5000, 5000])
        payload['client_id'] = str(uuid.uuid4()); payload['shares'][1]['value'] = '49.99'
        with self.assertRaises(AppError):
            self.store.save_expense(self.trip, payload)

    def test_partial_and_complete_settlement(self):
        self.store.save_expense(self.trip, self.expense())
        self.store.save_expense(self.trip, self.expense('300', payer=1, shares=[{'member_id': member} for member in self.members[:2]]))
        data = self.store.get_trip(self.trip)
        self.assertEqual([entry['net'] for entry in data['balances']], [45000, -15000, -30000])
        payload = self.payment(2, 0, '100')
        first = self.store.add_settlement(self.trip, payload)
        self.assertEqual(first, self.store.add_settlement(self.trip, payload))
        self.assertEqual(self.store.get_trip(self.trip)['outstanding'], 35000)
        for transfer in self.store.get_trip(self.trip)['transfers']:
            self.store.add_settlement(self.trip, {'payer_id': transfer['payer_id'], 'payee_id': transfer['payee_id'], 'amount': str(transfer['amount'] // 100), 'paid_on': '2026-10-27', 'client_id': str(uuid.uuid4())})
        self.assertEqual(self.store.get_trip(self.trip)['transfers'], [])
        self.store.delete_settlement(self.trip, first)
        self.assertEqual(self.store.get_trip(self.trip)['outstanding'], 10000)

    def test_failed_edits_are_atomic_and_stale_edits_rejected(self):
        payload = self.expense()
        expense_id = self.store.save_expense(self.trip, payload)
        original = self.store.get_trip(self.trip)['expenses'][0]
        payload['version'] = original['updated_at']; payload['payments'][0]['amount'] = '800'
        with self.assertRaises(AppError):
            self.store.save_expense(self.trip, payload, expense_id)
        self.assertEqual(self.store.get_trip(self.trip)['expenses'][0], original)
        payload['payments'][0]['amount'] = '900'; payload['title'] = '更正名稱'
        self.store.save_expense(self.trip, payload, expense_id)
        with self.assertRaises(AppError) as error:
            self.store.save_expense(self.trip, payload, expense_id)
        self.assertEqual(error.exception.status, 409)
        with self.assertRaises(AppError):
            self.store.delete_expense(self.trip, expense_id, original['updated_at'])

    def test_adding_members_does_not_change_old_shares(self):
        self.store.save_expense(self.trip, self.expense())
        before = self.store.get_trip(self.trip)['expenses'][0]['shares']
        new_member = self.store.add_member(self.trip, {'name': 'Dan'})
        self.assertEqual(self.store.get_trip(self.trip)['expenses'][0]['shares'], before)
        self.store.update_member(self.trip, new_member, {'name': 'Dora'})
        self.store.delete_member(self.trip, new_member)
        with self.assertRaises(AppError):
            self.store.delete_member(self.trip, self.members[0])

    def test_member_ids_cannot_cross_trip_boundaries(self):
        other = self.store.create_trip({'name': '另一組', 'members': ['A', 'B']})
        foreign = self.store.get_trip(other)['members'][0]['id']
        payload = self.expense(); payload['shares'][0]['member_id'] = foreign
        with self.assertRaises(AppError):
            self.store.save_expense(self.trip, payload)
        payload['shares'][0]['member_id'] = []
        with self.assertRaises(AppError):
            self.store.save_expense(self.trip, payload)

    def test_retries_and_concurrent_settlements(self):
        payload = self.expense('300')
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.store.save_expense(self.trip, payload), range(4)))
        self.assertEqual(len(set(results)), 1)
        self.assertEqual(len(self.store.get_trip(self.trip)['expenses']), 1)
        def settle(_):
            try:
                self.store.add_settlement(self.trip, self.payment(1, 0, '70'))
                return True
            except AppError:
                return False
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sum(pool.map(settle, range(2))), 1)
        self.assertEqual(self.store.get_trip(self.trip)['balances'][1]['net'], -3000)

    def test_currency_lock_and_persistence(self):
        self.store.save_expense(self.trip, self.expense())
        with self.assertRaises(AppError):
            self.store.update_trip(self.trip, {'name': '改幣別', 'currency': 'JPY'})
        reopened = Store(self.path)
        self.assertEqual(reopened.get_trip(self.trip)['total'], 90000)
        reopened.delete_trip(self.trip)
        self.assertEqual(reopened.list_trips(), [])

    def test_backup_is_a_restorable_independent_database(self):
        self.store.save_expense(self.trip, self.expense())
        backup = create_backup(self.path, Path(self.temp.name) / 'backups')
        self.store.delete_trip(self.trip)
        restored = Store(backup)
        self.assertEqual(restored.get_trip(self.trip)['total'], 90000)

    def test_transfer_recommendations_conserve_random_balances(self):
        rng = random.Random(16)
        for _ in range(200):
            amounts = [rng.randrange(-100000, 100000) for _ in range(15)]
            amounts.append(-sum(amounts))
            balances = [{'member_id': str(i), 'net': value} for i, value in enumerate(amounts)]
            remaining = {entry['member_id']: entry['net'] for entry in balances}
            for transfer in suggest_transfers(balances):
                self.assertGreater(transfer['amount'], 0)
                remaining[transfer['payer_id']] += transfer['amount']
                remaining[transfer['payee_id']] -= transfer['amount']
            self.assertTrue(all(value == 0 for value in remaining.values()))


if __name__ == '__main__':
    unittest.main()
