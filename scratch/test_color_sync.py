"""
Verification test for color sync rules in BioCrystal 3D:
1. BEFORE editing: All mutations MUST be ORANGE (#FF6500 / #EA580C). None are GREEN.
2. AFTER updating only: Only the edited position turns GREEN (#35C98A / #059669 / #10B981).
3. Unedited mutations remain ORANGE.
4. Restored mutations (restored to match reference) appear in GREEN with '(Restored)' label.
"""

def simulate_color_state(ref_seq, var_seq, orig_var_seq, edit_history):
    # Determine updated positions
    updated_positions = set()
    for rec in edit_history:
        if 'position' in rec:
            updated_positions.add(rec['position'])
    
    if orig_var_seq and var_seq and orig_var_seq != var_seq:
        min_len = min(len(orig_var_seq), len(var_seq))
        for i in range(min_len):
            if orig_var_seq[i] != var_seq[i]:
                updated_positions.add(i + 1)
        if len(orig_var_seq) != len(var_seq):
            for i in range(min_len, max(len(orig_var_seq), len(var_seq))):
                updated_positions.add(i + 1)
                
    # Detect mutations between ref_seq and var_seq
    mutations = []
    max_len = max(len(ref_seq), len(var_seq))
    for i in range(max_len):
        r = ref_seq[i] if i < len(ref_seq) else '-'
        o = var_seq[i] if i < len(var_seq) else '-'
        pos = i + 1
        is_mismatch = (r != '-' and o != '-' and r != o)
        if is_mismatch:
            mutations.append({
                'residue_number': pos,
                'ref': r,
                'obs': o,
                'dna_variant': f"c.{pos}{r}>{o}",
            })
            
    # Compute mappedResidues
    base_mappings = []
    for m in mutations:
        is_upd = m['residue_number'] in updated_positions
        base_mappings.append({
            'residue_number': m['residue_number'],
            'is_updated': is_upd,
            'color': '#35C98A' if is_upd else '#FF6500',
            'label': f"{m['dna_variant']} (Updated)" if is_upd else m['dna_variant'],
        })
        
    # Handle restored positions (in updated_positions but not in mutations because they match ref)
    existing_pos = {m['residue_number'] for m in base_mappings}
    for pos in updated_positions:
        if pos not in existing_pos and 1 <= pos <= len(var_seq):
            current_base = var_seq[pos - 1]
            base_mappings.append({
                'residue_number': pos,
                'is_updated': True,
                'color': '#35C98A',
                'label': f"c.{pos}{current_base} (Restored)",
            })
            
    return updated_positions, base_mappings

# TEST 1: Initial state before any edit (pos 7 has G>T, pos 12 has A>C)
ref = "ATGACTGATCGATCG"
# Pos 7 (index 6): ref is G, var is T
# Pos 12 (index 11): ref is A, var is C
var_initial = "ATGACTTATCGCTCG"
updated_pos, mappings = simulate_color_state(ref, var_initial, var_initial, [])
print("TEST 1 - BEFORE EDITING:")
print("Updated positions:", updated_pos)
for m in mappings:
    print(f"  Pos {m['residue_number']}: is_updated={m['is_updated']}, color={m['color']}, label={m['label']}")
assert len(updated_pos) == 0, "Updated positions must be empty before editing"
assert all(not m['is_updated'] and m['color'] == '#FF6500' for m in mappings), "All mutations must be ORANGE before editing!"
print("=> PASS: All initial mutations are strictly ORANGE (#FF6500), none are GREEN!\n")

# TEST 2: User edits position 7 to match reference G (restoration)
var_edited_1 = "ATGACTGATCGCTCG"  # pos 7 restored to G, pos 12 is still C
edit_history_1 = [{'position': 7, 'oldBases': 'T', 'newBases': 'G'}]
updated_pos_1, mappings_1 = simulate_color_state(ref, var_edited_1, var_initial, edit_history_1)
print("TEST 2 - AFTER RESTORING POS 7 TO REFERENCE:")
print("Updated positions:", updated_pos_1)
for m in mappings_1:
    print(f"  Pos {m['residue_number']}: is_updated={m['is_updated']}, color={m['color']}, label={m['label']}")
m7 = next(m for m in mappings_1 if m['residue_number'] == 7)
m12 = next(m for m in mappings_1 if m['residue_number'] == 12)
assert m7['is_updated'] is True and m7['color'] == '#35C98A' and 'Restored' in m7['label'], "Pos 7 must be GREEN (Restored)"
assert m12['is_updated'] is False and m12['color'] == '#FF6500', "Pos 12 was unedited and must remain ORANGE"
print("=> PASS: Position 7 is GREEN (#35C98A) with (Restored), unedited position 12 remains ORANGE (#FF6500)!\n")

# TEST 3: User edits position 7 to another base A
var_edited_2 = "ATGACTIATCGCTCG".replace('I', 'A')  # pos 7 is A
edit_history_2 = [{'position': 7, 'oldBases': 'T', 'newBases': 'A'}]
updated_pos_2, mappings_2 = simulate_color_state(ref, var_edited_2, var_initial, edit_history_2)
print("TEST 3 - AFTER EDITING POS 7 TO 'A':")
print("Updated positions:", updated_pos_2)
for m in mappings_2:
    print(f"  Pos {m['residue_number']}: is_updated={m['is_updated']}, color={m['color']}, label={m['label']}")
m7 = next(m for m in mappings_2 if m['residue_number'] == 7)
m12 = next(m for m in mappings_2 if m['residue_number'] == 12)
assert m7['is_updated'] is True and m7['color'] == '#35C98A' and 'Updated' in m7['label'], "Pos 7 must be GREEN (Updated)"
assert m12['is_updated'] is False and m12['color'] == '#FF6500', "Pos 12 was unedited and must remain ORANGE"
print("=> PASS: Position 7 is GREEN (#35C98A) with (Updated), unedited position 12 remains ORANGE (#FF6500)!\n")

print("ALL COLOR SYNCHRONIZATION TESTS PASSED PERFECTLY!")

