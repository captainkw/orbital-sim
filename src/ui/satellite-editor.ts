export interface SatelliteEntry {
  id: number;
  name: string;
}

export class SatelliteEditor {
  private button: HTMLButtonElement;
  private panel: HTMLDivElement;
  private listContainer: HTMLDivElement;
  private nameInput!: HTMLInputElement;
  private visible = false;
  private nextId = 1;
  private entries: SatelliteEntry[] = [];

  private onAdd: ((entry: SatelliteEntry) => void) | null = null;
  private onRemove: ((id: number) => void) | null = null;

  constructor() {
    this.button = document.createElement('button');
    this.button.textContent = '+ Add Satellite';
    Object.assign(this.button.style, {
      position: 'fixed',
      bottom: '60px',
      left: '10px',
      padding: '6px 14px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: '#00ff88',
      border: '1px solid #00ff88',
      borderRadius: '4px',
      fontFamily: "'Courier New', monospace",
      fontSize: '12px',
      cursor: 'pointer',
      zIndex: '1000',
      pointerEvents: 'auto',
    });
    document.body.appendChild(this.button);
    this.button.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.panel = document.createElement('div');
    Object.assign(this.panel.style, {
      position: 'fixed',
      bottom: '96px',
      left: '10px',
      width: '300px',
      maxHeight: '70vh',
      overflowY: 'auto',
      background: 'rgba(0, 0, 0, 0.92)',
      border: '1px solid #00ff88',
      borderRadius: '6px',
      padding: '14px',
      fontFamily: "'Courier New', monospace",
      fontSize: '12px',
      color: '#00ff88',
      zIndex: '1000',
      pointerEvents: 'auto',
      display: 'none',
    });
    document.body.appendChild(this.panel);

    this.listContainer = document.createElement('div');
    this.buildPanel();
  }

  setAddCallback(cb: (entry: SatelliteEntry) => void) { this.onAdd = cb; }
  setRemoveCallback(cb: (id: number) => void) { this.onRemove = cb; }

  getEntryName(id: number): string | null {
    return this.entries.find(e => e.id === id)?.name ?? null;
  }

  private buildPanel() {
    this.panel.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';
    const title = document.createElement('span');
    title.textContent = 'Add Satellite';
    title.style.cssText = 'font-size:14px;font-weight:bold;';
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = 'cursor:pointer;color:#888;font-size:16px;padding:0 4px;';
    closeBtn.addEventListener('pointerup', (e) => { e.stopPropagation(); this.hide(); });
    header.append(title, closeBtn);
    this.panel.appendChild(header);

    // Description
    const desc = document.createElement('div');
    desc.textContent = 'Enter a telemetry parameter name. Position will be read from {name}.latitude and {name}.longitude.';
    desc.style.cssText = 'color:#888;font-size:10px;margin-bottom:10px;line-height:1.4;';
    this.panel.appendChild(desc);

    // Name input
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;';
    const nameLabel = document.createElement('span');
    nameLabel.textContent = 'Name';
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'e.g. iss.position';
    Object.assign(this.nameInput.style, {
      background: 'rgba(0, 0, 0, 0.7)',
      color: '#00ff88',
      border: '1px solid #00ff88',
      fontFamily: "'Courier New', monospace",
      fontSize: '11px',
      padding: '4px 6px',
      width: '180px',
      borderRadius: '2px',
    });
    nameRow.append(nameLabel, this.nameInput);
    this.panel.appendChild(nameRow);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add to Simulation';
    Object.assign(addBtn.style, {
      width: '100%',
      marginTop: '10px',
      padding: '8px',
      background: 'rgba(0, 255, 136, 0.15)',
      color: '#00ff88',
      border: '1px solid #00ff88',
      borderRadius: '4px',
      fontFamily: "'Courier New', monospace",
      fontSize: '12px',
      cursor: 'pointer',
    });
    addBtn.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      this.handleAdd();
    });
    this.panel.appendChild(addBtn);

    // Separator + satellite list
    const sep = document.createElement('hr');
    sep.style.cssText = 'border:none;border-top:1px solid #333;margin:12px 0 8px;';
    this.panel.appendChild(sep);

    const listTitle = document.createElement('div');
    listTitle.textContent = 'Active Satellites';
    listTitle.style.cssText = 'color:#888;margin-bottom:6px;';
    this.panel.appendChild(listTitle);

    this.listContainer = document.createElement('div');
    this.panel.appendChild(this.listContainer);
    this.renderList();
  }

  private handleAdd() {
    const name = this.nameInput.value.trim();
    if (!name) { return; }

    const id = this.nextId++;
    const entry: SatelliteEntry = { id, name };
    this.entries.push(entry);
    this.onAdd?.(entry);
    this.nameInput.value = '';
    this.renderList();
  }

  private renderList() {
    this.listContainer.innerHTML = '';
    if (this.entries.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'None added yet';
      empty.style.cssText = 'color:#555;font-size:11px;';
      this.listContainer.appendChild(empty);
      return;
    }

    for (const entry of this.entries) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:5px 6px;margin-bottom:2px;border-radius:3px;border:1px solid #333;';

      const nameEl = document.createElement('span');
      nameEl.textContent = entry.name;
      nameEl.style.cssText = 'flex:1;color:#aaa;';

      const removeBtn = document.createElement('span');
      removeBtn.textContent = '\u2715';
      removeBtn.style.cssText = 'cursor:pointer;color:#ff4444;padding:2px 6px;font-size:11px;';
      removeBtn.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        this.entries = this.entries.filter(en => en.id !== entry.id);
        this.onRemove?.(entry.id);
        this.renderList();
      });

      row.append(nameEl, removeBtn);
      this.listContainer.appendChild(row);
    }
  }

  private toggle() {
    this.visible ? this.hide() : this.show();
  }

  private show() {
    this.visible = true;
    this.panel.style.display = 'block';
  }

  private hide() {
    this.visible = false;
    this.panel.style.display = 'none';
  }
}
