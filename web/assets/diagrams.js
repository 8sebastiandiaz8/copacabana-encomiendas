const select = document.querySelector('#diagram-select');
const img = document.querySelector('#diagram-image');
try {
  const response = await fetch('diagramas/index.json');
  if (!response.ok) throw new Error('No se pudo cargar el índice de diagramas.');
  const diagrams = await response.json();
  for (const diagram of diagrams) select.add(new Option(diagram.name, diagram.slug));
  function show(slug) {
    const item = diagrams.find(d => d.slug === slug) || diagrams[0];
    select.value = item.slug;
    document.querySelector('#diagram-name').textContent = item.name;
    document.querySelector('#diagram-caption').textContent = item.caption;
    img.src = 'diagramas/' + item.slug + '.svg'; img.alt = item.name;
    document.querySelector('#download-scene').href = 'diagramas/' + item.slug + '.excalidraw';
    document.querySelector('#download-svg').href = img.src;
    history.replaceState(null, '', '?id=' + encodeURIComponent(item.slug));
  }
  show(new URLSearchParams(location.search).get('id'));
  select.addEventListener('change', () => show(select.value));
  document.querySelector('#diagram-zoom').addEventListener('click', event => {
    const enlarged = img.classList.toggle('full-size');
    event.target.textContent = enlarged ? 'Ajustar al ancho' : 'Ampliar al 100 %';
  });
} catch (error) { document.querySelector('#diagram-caption').textContent = error.message; }
