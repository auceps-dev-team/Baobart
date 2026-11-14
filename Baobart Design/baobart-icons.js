// Baobart icon set — duo style: colored plate (offset) + 2px black line on a 24 grid.
// Each icon: f = shapes filled with color (also outlined), l = extra line strokes.
(function () {
  const I = {
    // Navigation
    home: { f: '<path d="M4 10.5 12 4l8 6.5V20H4z"/>', l: '<path d="M10 20v-5h4v5"/>' },
    dashboard: { f: '<rect x="4" y="4" width="7" height="9" rx="1.5"/><rect x="13" y="11" width="7" height="9" rx="1.5"/>', l: '<rect x="13" y="4" width="7" height="4" rx="1.5"/><rect x="4" y="16" width="7" height="4" rx="1.5"/>' },
    folder: { f: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', l: '<path d="M3 10.5h18"/>' },
    message: { f: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2z"/>', l: '<path d="M8.5 9h7M8.5 12.5h4"/>' },
    calendar: { f: '<rect x="4" y="5.5" width="16" height="15" rx="2"/>', l: '<path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M8 14h2M14 14h2M8 17h2"/>' },
    search: { f: '<circle cx="10.5" cy="10.5" r="6.5"/>', l: '<path d="m15.5 15.5 5 5"/>' },
    compass: { f: '<circle cx="12" cy="12" r="8.5"/>', l: '<path d="m15.5 8.5-2 5-5 2 2-5z"/>' },
    users: { f: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0z"/>', l: '<path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18 14.3a6 6 0 0 1 3 5.2"/>' },
    // Actions
    plus: { f: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/>', l: '<path d="M12 8v8M8 12h8"/>' },
    edit: { f: '<path d="m15 4.5 4.5 4.5L9 19.5H4.5V15z"/>', l: '<path d="m12.5 7 4.5 4.5"/>' },
    trash: { f: '<path d="M6 7h12l-1 13H7z"/>', l: '<path d="M4 7h16M9.5 7V4.5h5V7M10 11v5M14 11v5"/>' },
    share: { f: '<circle cx="6.5" cy="12" r="2.8"/><circle cx="17.5" cy="6" r="2.8"/><circle cx="17.5" cy="18" r="2.8"/>', l: '<path d="m9 10.6 6-3.2M9 13.4l6 3.2"/>' },
    download: { f: '<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3z"/>', l: '<path d="M12 3.5V14M7.5 10l4.5 4.5 4.5-4.5"/>' },
    upload: { f: '<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3z"/>', l: '<path d="M12 14V3.5M7.5 8 12 3.5 16.5 8"/>' },
    filter: { f: '<path d="M4 5h16l-6 7.5V19l-4 2v-8.5z"/>', l: '' },
    more: { f: '<circle cx="5.5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18.5" cy="12" r="2"/>', l: '' },
    // Fichiers & médias
    file: { f: '<path d="M6 3.5h8l4.5 4.5v12.5H6z"/>', l: '<path d="M14 3.5V8h4.5M9 13h6M9 16.5h4"/>' },
    image: { f: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/>', l: '<circle cx="9" cy="9.5" r="1.6"/><path d="m3.5 17 5-4.5 4 3.5 3-2.5 5 4"/>' },
    video: { f: '<rect x="3" y="6" width="13" height="12" rx="2"/>', l: '<path d="m16 10.5 5-3v9l-5-3"/>' },
    mic: { f: '<rect x="8.5" y="3" width="7" height="11.5" rx="3.5"/>', l: '<path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>' },
    link: { f: '<rect x="2.5" y="8.5" width="10" height="7" rx="3.5"/>', l: '<rect x="11.5" y="8.5" width="10" height="7" rx="3.5"/><path d="M8.5 12h7"/>' },
    attach: { f: '', l: '<path d="m20 11.5-7.8 7.8a4.6 4.6 0 0 1-6.5-6.5l8.3-8.3a3 3 0 0 1 4.3 4.3l-8.2 8.2a1.5 1.5 0 0 1-2.1-2.1L15.5 7.5"/>' },
    camera: { f: '<path d="M3.5 8.5a2 2 0 0 1 2-2h2.5L9.5 4h5L16 6.5h2.5a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>', l: '<circle cx="12" cy="13" r="3.5"/>' },
    // Paiement & commandes
    card: { f: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/>', l: '<path d="M2.5 9.5h19M6 15h4"/>' },
    cart: { f: '<path d="M6 6.5h15l-2 8H7.5z"/>', l: '<path d="M2.5 3.5h2.5L7.5 14.5"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17.5" cy="19.5" r="1.5"/>' },
    bag: { f: '<path d="M5 8h14l-1 12.5H6z"/>', l: '<path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>' },
    wallet: { f: '<path d="M3.5 7a2 2 0 0 1 2-2H18v3h1a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H5.5a2 2 0 0 1-2-2z"/>', l: '<path d="M3.5 7.5a2 2 0 0 0 2 1H18"/><circle cx="16.5" cy="14.5" r="1.2"/>' },
    receipt: { f: '<path d="M5.5 3.5h13v17l-2.2-1.5-2.1 1.5-2.2-1.5-2.2 1.5-2.1-1.5-2.2 1.5z"/>', l: '<path d="M9 8.5h6M9 12h6M9 15.5h3"/>' },
    tag: { f: '<path d="M3.5 4.5a1 1 0 0 1 1-1h7.2l9 9-8.2 8.2-9-9z"/>', l: '<circle cx="8.5" cy="8.5" r="1.6"/>' },
    coins: { f: '<ellipse cx="9" cy="7.5" rx="5.5" ry="2.5"/>', l: '<path d="M3.5 7.5v4c0 1.4 2.5 2.5 5.5 2.5M3.5 11.5v4c0 1.4 2.5 2.5 5.5 2.5"/><ellipse cx="15.5" cy="13.5" rx="5" ry="2.3"/><path d="M10.5 13.5v4.2c0 1.3 2.2 2.3 5 2.3s5-1 5-2.3v-4.2"/>' },
    truck: { f: '<path d="M2.5 6h11v11h-11z"/>', l: '<path d="M13.5 9.5h4l3.5 4V17h-7.5"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>' },
    // Statuts & notifications
    bell: { f: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/>', l: '<path d="M10 21h4"/>' },
    check: { f: '<circle cx="12" cy="12" r="8.5"/>', l: '<path d="m8 12.3 2.8 2.7L16.2 9.5"/>' },
    alert: { f: '<path d="M12 3.5 21.5 20h-19z"/>', l: '<path d="M12 10v4.5M12 17.3v.2"/>' },
    info: { f: '<circle cx="12" cy="12" r="8.5"/>', l: '<path d="M12 11v5.5M12 7.8v.2"/>' },
    clock: { f: '<circle cx="12" cy="12" r="8.5"/>', l: '<path d="M12 7.5V12l3 2"/>' },
    star: { f: '<path d="m12 3.5 2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.8l-5.4 2.9 1.2-5.9-4.4-4.1 6-.7z"/>', l: '' },
    heart: { f: '<path d="M12 20s-8-4.6-8-10.4A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.6C20 15.4 12 20 12 20z"/>', l: '' },
    // Profil & paramètres
    user: { f: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0z"/>', l: '' },
    sliders: { f: '<circle cx="9" cy="7" r="2.3"/><circle cx="15" cy="17" r="2.3"/>', l: '<path d="M4 7h2.7M11.3 7H20M4 17h8.7M17.3 17H20"/>' },
    lock: { f: '<rect x="4.5" y="10" width="15" height="10.5" rx="2"/>', l: '<path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14v2.5"/>' },
    logout: { f: '<path d="M4 4.5h9v15H4z"/>', l: '<path d="M16.5 8.5 20 12l-3.5 3.5M9.5 12H20"/>' },
    shield: { f: '<path d="M12 3.5 19.5 6v5.5c0 4.6-3.2 7.8-7.5 9-4.3-1.2-7.5-4.4-7.5-9V6z"/>', l: '<path d="m9 12 2.2 2.2L15.5 10"/>' },
    eye: { f: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/>', l: '<circle cx="12" cy="12" r="3"/>' },
    // Analytique
    bars: { f: '<rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="5" width="4" height="15" rx="1"/><rect x="16" y="9" width="4" height="11" rx="1"/>', l: '' },
    trend: { f: '<path d="M3.5 20.5V15l5-5 4 3.5 8-8v15z"/>', l: '<path d="M15.5 5.5h5v5"/>' },
    pie: { f: '<path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5H12z"/>', l: '<path d="M10 5.8A8.5 8.5 0 1 0 18.2 14H10z"/>' },
    target: { f: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2"/>' },
    trophy: { f: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/>', l: '<path d="M7 6H4v1.5a3 3 0 0 0 3.2 3M17 6h3v1.5a3 3 0 0 1-3.2 3M12 14v3.5M8.5 20.5h7l-.8-3h-5.4z"/>' }
  };
  window.BB_ICONS = I;
  class BBIcon extends HTMLElement {
    static get observedAttributes() { return ['name', 'color', 'size', 'line', 'offset']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const ic = I[this.getAttribute('name')];
      const size = this.getAttribute('size') || 24;
      const color = this.getAttribute('color') || '#FFD84A';
      const line = this.getAttribute('line') || '#121212';
      const o = this.getAttribute('offset') ?? 1.6;
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      const host = `<style>:host{display:inline-block;width:${size}px;height:${size}px;flex:none;line-height:0}</style>`;
      if (!ic) { root.innerHTML = host; return; }
      root.innerHTML = host + `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="overflow:visible;display:block" aria-hidden="true">` +
        `<g transform="translate(${o} ${o})" fill="${color}" stroke="${color}" stroke-width="2" stroke-linejoin="round">${ic.f}</g>` +
        `<g fill="none" stroke="${line}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ic.f}${ic.l}</g></svg>`;
    }
  }
  if (!customElements.get('bb-icon')) customElements.define('bb-icon', BBIcon);
})();
