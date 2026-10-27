"""Consistent SQLite backup, including committed data currently in the WAL."""
import argparse
from contextlib import closing
from datetime import datetime
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parent


def create_backup(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    if not source.is_file():
        raise FileNotFoundError('找不到資料庫，請先啟動並使用旅伴分帳。')
    output.mkdir(parents=True, exist_ok=True)
    destination = output / ('trips-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.sqlite3')
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as original:
        with closing(sqlite3.connect(destination)) as backup:
            original.backup(backup)
            if backup.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('備份資料庫完整性檢查失敗。')
    return destination


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='備份旅伴分帳 SQLite 資料庫')
    parser.add_argument('--db', type=Path, default=ROOT / 'data' / 'trips.sqlite3')
    parser.add_argument('--output', type=Path, default=ROOT / 'backups')
    args = parser.parse_args()
    try:
        print('備份完成：' + str(create_backup(args.db, args.output)))
    except (OSError, sqlite3.Error, RuntimeError) as error:
        raise SystemExit('備份失敗：' + str(error)) from None
