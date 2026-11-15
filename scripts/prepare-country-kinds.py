"""Extract Natural Earth's published administrative-unit classifications.
Usage: python scripts/prepare-country-kinds.py ne_10m_admin_0_countries.zip
Public-domain metadata only; country geometry and rotations stay unchanged.
"""
import hashlib
import io
import json
import sys
from pathlib import Path
from zipfile import ZipFile
import shapefile

source = Path(sys.argv[1])
with ZipFile(source) as archive:
    dbf = next(name for name in archive.namelist() if name.endswith('.dbf'))
    records = [record.as_dict() for record in shapefile.Reader(dbf=io.BytesIO(archive.read(dbf))).records()]
result = dict(
    source='https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/',
    archive='https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries.zip',
    version='5.1.1', license='Natural Earth public domain',
    inputSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),
    units={record['ADMIN']: dict(type=record['TYPE'], sovereign=record['SOVEREIGNT'])
           for record in sorted(records, key=lambda record: record['ADMIN'])})
output = Path(__file__).resolve().parents[1]/'data/country-kinds.json'
output.write_text(json.dumps(result, indent=2, ensure_ascii=False)+'\n')
print('Administrative metadata:', len(result['units']), 'source units')
