import urllib.request
import json

def test_api():
    base = 'http://127.0.0.1:8000'
    ref = 'ATGGCTGAATTTCCGAAATAA'
    # Initial mutated sequence (pos 7 is T)
    var1 = 'ATGGCTTAATTTCCGAAATAA'
    
    # 1. Initial compare
    payload1 = {
        'reference_sequence': ref,
        'observed_sequence': var1,
        'context': {
            'organism': 'Homo sapiens',
            'gene': 'DEMO1',
            'accession': 'NM_000000',
            'sequenceType': 'coding',
            'strandOrientation': 'forward',
            'readingFrame': 0,
            'geneticCode': 'standard'
        },
        'options': {
            'detectDifferences': True,
            'referenceGuided': True,
            'codingConsequence': True,
            'structuralMapping': True,
            'generateReport': False
        }
    }
    req = urllib.request.Request(f'{base}/api/compare', data=json.dumps(payload1).encode('utf-8'), headers={'Content-Type': 'application/json'})
    res = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
    print('Initial compare mutations:', res['alignment']['mutation_count'])
    assert res['alignment']['mutation_count'] == 1
    m = res['alignment']['mutations'][0]
    print(f"Mutation 1: Pos {m['observed_position']}, {m.get('reference_bases') or m.get('original_base')}>{m.get('observed_bases') or m.get('observed_base')}")

    # 2. Reanalyse after restoring pos 7 to G
    var2 = 'ATGGCTGAATTTCCGAAATAA'
    payload2 = {
        'reference_sequence': ref,
        'observed_sequence': var2,
        'context': {
            'organism': 'Homo sapiens',
            'gene': 'DEMO1',
            'accession': 'NM_000000',
            'sequenceType': 'coding',
            'strandOrientation': 'forward',
            'readingFrame': 0,
            'geneticCode': 'standard'
        },
        'options': {
            'detectDifferences': True,
            'referenceGuided': True,
            'codingConsequence': True,
            'structuralMapping': True,
            'generateReport': False
        }
    }
    req2 = urllib.request.Request(f'{base}/api/compare', data=json.dumps(payload2).encode('utf-8'), headers={'Content-Type': 'application/json'})
    res2 = json.loads(urllib.request.urlopen(req2).read().decode('utf-8'))
    print('After Use Reference (G) mutations:', res2['alignment']['mutation_count'])
    assert res2['alignment']['mutation_count'] == 0
    print('DNA structure PDB length:', len(res2['dna_structure']['pdb_data']))
    print('ALL ENDPOINTS AND RESTORATION RESPONSES SUCCEEDED PERFECTLY!')

if __name__ == '__main__':
    test_api()
