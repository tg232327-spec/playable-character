import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

function controls() {
  const source = readFileSync('public/game/game.js', 'utf8');
  const start = source.indexOf('let lastDragX=0;');
  const end = source.indexOf("document.addEventListener('visibilitychange'", start);
  const handlers: Record<string, (event: any) => void> = {};
  const captured = new Set<number>();
  const canvas = {
    addEventListener: (name: string, handler: (event: any) => void) => { handlers[name] = handler; },
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => captured.delete(id),
  };
  const state = { onFoot: true, orbit: 0 };
  const attack = vi.fn();
  const fire = vi.fn();
  const guns = { drawn: -1, fire };
  new Function('renderer', 'state', 'entry', 'guns', 'brawling', 'rides', source.slice(start, end))(
    { domElement: canvas }, state, null, guns, { attack }, { active: false },
  );
  const send = (name: string, x = 100, y = 100, extras = {}) => handlers[name]?.({ pointerId: 1, button: 0, pointerType: 'mouse', clientX: x, clientY: y, ...extras });
  return { send, state, attack, fire, guns };
}

describe('camera drag versus attack', () => {
  it('does not punch when pressing or dragging the camera', () => {
    const c = controls();
    c.send('pointerdown');
    expect(c.attack).not.toHaveBeenCalled();
    c.send('pointermove', 160);
    c.send('pointerup', 160);
    expect(c.state.orbit).not.toBe(0);
    expect(c.attack).not.toHaveBeenCalled();
  });
  it('punches once when a stationary left click is released', () => {
    const c = controls();
    c.send('pointerdown');
    c.send('pointerup');
    expect(c.attack).toHaveBeenCalledTimes(1);
  });
  it('does not fire a drawn gun during a vertical drag', () => {
    const c = controls(); c.guns.drawn = 0;
    c.send('pointerdown'); c.send('pointermove', 100, 160); c.send('pointerup', 100, 160);
    expect(c.fire).not.toHaveBeenCalled();
  });
  it('does not attack after a cancelled pointer or a touch tap', () => {
    const c = controls();
    c.send('pointerdown'); c.send('pointercancel'); c.send('pointerup');
    c.send('pointerdown', 100, 100, { pointerType: 'touch' }); c.send('pointerup', 100, 100, { pointerType: 'touch' });
    expect(c.attack).not.toHaveBeenCalled();
  });
});