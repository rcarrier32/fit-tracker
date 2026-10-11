/**
 * PJF Extended Length Band exercise database: every band exercise, by category, with its
 * PJF demo video. Opens as a sheet from Programs. Rows use the shared exercise UI.
 */
import { loadCatalogs } from '../lib/static_data.js';
import { openSheet } from '../app.js';
import { esc, exerciseRowHTML, wireExerciseRows, openExerciseDetail } from '../lib/exercise_ui.js';

const ACCENT = '#22c55e';

export async function openBandDatabase() {
  const { exercises, bandOverviews } = await loadCatalogs();
  const band = exercises.filter(e => e.sources?.includes('band') && !e.program_only);
  const categories = [...new Set(band.map(e => e.category))];

  openSheet((sheet) => {
    let cat = categories[0];
    let q = '';

    sheet.innerHTML = `
      <h2 style="margin-bottom:2px">Extended Band Database</h2>
      <div class="muted" style="font-size:12px;margin-bottom:10px">PJF Performance · ${band.length} exercises · tap one for its demo</div>
      <div class="search-bar"><input type="text" id="band-search" placeholder="Search band exercises…" autocomplete="off"></div>
      <div id="band-cats" style="display:flex;gap:6px;overflow-x:auto;padding:8px 0 10px;-webkit-overflow-scrolling:touch"></div>
      <div id="band-list" style="display:flex;flex-direction:column;gap:8px"></div>
    `;
    const $cats = sheet.querySelector('#band-cats');
    const $list = sheet.querySelector('#band-list');

    function render() {
      $cats.innerHTML = categories.map(c => `
        <button class="pill${c === cat && !q ? ' accent' : ''}" data-cat="${esc(c)}"
          style="flex-shrink:0;cursor:pointer;white-space:nowrap">${esc(c)}</button>`).join('');
      $cats.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
        cat = b.dataset.cat;
        q = '';
        sheet.querySelector('#band-search').value = '';
        render();
      });

      const shown = q
        ? band.filter(e => e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
        : band.filter(e => e.category === cat);
      const overview = !q && bandOverviews[cat]
        ? exerciseRowHTML({ id: '__overview', name: `${cat}: band setup overview`, video_url: bandOverviews[cat] },
          { check: false, accent: ACCENT, badge: 'START HERE' })
        : '';
      $list.innerHTML = overview + (shown.length
        ? shown.map(e => exerciseRowHTML(e, { check: false, accent: ACCENT, rx: q ? e.category : '' })).join('')
        : `<div class="muted" style="padding:12px 0">No band exercises match.</div>`);

      wireExerciseRows($list, {
        open: (id) => {
          if (id === '__overview') {
            openExerciseDetail({ name: `${cat}: overview`, video_url: bandOverviews[cat],
              subtitle: 'How to set up the band for this category', source: 'PJF band' }, { accent: ACCENT });
            return;
          }
          const i = shown.findIndex(e => e.id === id);
          openDetail(shown, i);
        },
      });
    }

    // Next → walks the current list, so you can flip through a category.
    function openDetail(list, i) {
      const e = list[i];
      if (!e) return;
      const nxt = list[i + 1];
      openExerciseDetail({ ...e, subtitle: e.category, source: 'PJF band' }, {
        accent: ACCENT,
        actions: nxt ? [{ label: `Next: ${nxt.name} →`, onClick: (close) => { close(false); openDetail(list, i + 1); } }] : [],
      });
    }

    sheet.querySelector('#band-search').oninput = (ev) => {
      q = ev.target.value.trim().toLowerCase();
      render();
    };
    render();
  });
}
