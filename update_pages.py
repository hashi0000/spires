#!/usr/bin/env python3
"""Update all SEO landing pages to match index.html structure"""
import re
from pathlib import Path

# Read the correct header/footer/JS from index.html
index_path = Path('index.html')
index_content = index_path.read_text(encoding='utf-8')

# Extract header (from <!-- Header / Navbar --> to </div> after mobile nav panel)
header_match = re.search(r'(<!-- Header / Navbar -->.*?<!-- Mobile Navigation Panel -->.*?</div>)', index_content, re.DOTALL)
header = header_match.group(1) if header_match else None

# Extract footer (from <!-- FOOTER --> to </html>)
footer_match = re.search(r'(<!-- FOOTER -->.*?</html>)', index_content, re.DOTALL)
footer = footer_match.group(1) if footer_match else None

if not header or not footer:
    print("Could not extract header/footer from index.html")
    exit(1)

# Files to update
files = [
    'gatwick-airport-taxis.html',
    'birmingham-airport-taxis.html',
    'oxford-taxis.html',
    'abingdon-taxis.html',
    'bicester-taxis.html',
    'airport-transfers.html',
    'corporate-taxis.html',
    'student-taxis.html',
]

for filename in files:
    path = Path(filename)
    if not path.exists():
        print(f"Skipping {filename} - not found")
        continue
    
    content = path.read_text(encoding='utf-8')
    
    # Find body start
    body_start = content.find('<body')
    if body_start == -1:
        print(f"Skipping {filename} - no body tag")
        continue
    
    body_end = content.find('>', body_start) + 1
    
    # Find first section (hero)
    hero_start = content.find('<section', body_end)
    if hero_start == -1:
        print(f"Skipping {filename} - no hero section")
        continue
    
    # Find footer start
    footer_start = content.find('<footer class="footer">')
    if footer_start == -1:
        print(f"Skipping {filename} - no footer")
        continue
    
    # Reconstruct file
    head_section = content[:body_end]
    main_content = content[hero_start:footer_start]
    new_content = head_section + '\n' + header + '\n' + main_content + footer
    
    path.write_text(new_content, encoding='utf-8')
    print(f"Updated {filename}")

print("Done!")

