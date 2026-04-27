import re

with open('c:\\Users\\ivanz\\Documents\\tp-integrador\\js\\main.js.bak', 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Conflict 1: Imports
# We want HEAD imports + trenes
c1 = r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> upstream/prueba-trenes\n'
def repl1(m):
    head_content = m.group(1)
    return head_content + \"\\nimport { openTrenesView, handleTrenesListInteraction, getStationLineFromRamales } from './trenes.js';\\n\"

content = re.sub(c1, repl1, content, count=1, flags=re.DOTALL)

# Conflict 2: persistTrainStationsCache
c2 = r'<<<<<<< HEAD\n=======\n(.*?)>>>>>>> upstream/prueba-trenes\n'
def repl2(m):
    return m.group(1)

content = re.sub(c2, repl2, content, count=1, flags=re.DOTALL)

# Conflict 3: getItemTripId etc
c3 = r'<<<<<<< HEAD\n=======\n(.*?)>>>>>>> upstream/prueba-trenes\n'
def repl3(m):
    return '' # Discard upstream render functions

content = re.sub(c3, repl3, content, count=1, flags=re.DOTALL)

# Conflict 4 & 5: currentView === 'subtes' and switch(viewName)
c4 = r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> upstream/prueba-trenes\n'
def repl4(m):
    return m.group(1)

content = re.sub(c4, repl4, content, count=2, flags=re.DOTALL)

# Conflict 6: parseCsvLine
c6 = r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> upstream/prueba-trenes\n'
def repl6(m):
    return m.group(1)

content = re.sub(c6, repl6, content, count=1, flags=re.DOTALL)

# Conflict 7: favorite-detail
c7 = r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> upstream/prueba-trenes\n'
def repl7(m):
    return m.group(1)

content = re.sub(c7, repl7, content, count=1, flags=re.DOTALL)

# Conflict 8: staticSubteData = await fetchStaticSubteData();
c8 = r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> upstream/prueba-trenes\n'
def repl8(m):
    return m.group(1)

content = re.sub(c8, repl8, content, count=1, flags=re.DOTALL)

# Conflict 9: homeColectivosCard
c9 = r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> upstream/prueba-trenes\n'
def repl9(m):
    head_code = m.group(1)
    # the upstream code had:
    # const homeTrenesCard = document.getElementById('homeTrenesCard');
    return head_code + \"\\n  const homeTrenesCard = document.getElementById('homeTrenesCard');\\n\"

content = re.sub(c9, repl9, content, count=1, flags=re.DOTALL)

# Conflict 10: colectivosPrevBtn
c10 = r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> upstream/prueba-trenes\n'
def repl10(m):
    return m.group(1)

content = re.sub(c10, repl10, content, count=1, flags=re.DOTALL)

# Conflict 11: searchButton
c11 = r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> upstream/prueba-trenes\n'
def repl11(m):
    return m.group(1)

content = re.sub(c11, repl11, content, count=1, flags=re.DOTALL)


# Now strip initFavoritesModule, initHistoryModule, initSearchModule
content = re.sub(r'  initFavoritesModule\(\{.*?\}\);\\n', '', content, flags=re.DOTALL)
content = re.sub(r'  initHistoryModule\(\{.*?\}\);\\n', '', content, flags=re.DOTALL)
content = re.sub(r'  initSearchModule\(\{.*?\}\);\\n', '', content, flags=re.DOTALL)
content = re.sub(r'  setSearchTransportType\(\\'trenes\'\);\\n', '', content, flags=re.DOTALL)

# Write output
with open('c:\\Users\\ivanz\\Documents\\tp-integrador\\js\\main.js', 'w', encoding='utf-8-sig') as f:
    f.write(content)
