// Keyboard and mouse for one canvas. Held keys answer "is it down now", and a small queue of
// edges (pressed this frame) answers the one-shot actions such as entering a car or firing once.
// Mouse coordinates are kept in canvas pixels, so the HUD's logical scale is applied where it is
// drawn, not here.

const BLOCKING = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'KeyE', 'KeyR', 'KeyM',
]);

export function createInput(canvas) {
  const held = new Set();
  const edges = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let wheel = 0;

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
  }

  window.addEventListener('keydown', (event) => {
    if (BLOCKING.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    edges.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', toCanvas);
  canvas.addEventListener('mousedown', (event) => {
    toCanvas(event);
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('wheel', (event) => {
    wheel += Math.sign(event.deltaY);
    event.preventDefault();
  }, { passive: false });

  return {
    mouse,
    /** Is the key held this frame? */
    down(code) {
      return held.has(code);
    },
    /** Was it pressed since the last consume? */
    pressed(code) {
      return edges.has(code);
    },
    /** Read and clear one edge. */
    take(code) {
      const had = edges.has(code);
      edges.delete(code);
      return had;
    },
    /** Mouse button edge, cleared when read. */
    takeClick() {
      const had = mouse.clicked;
      mouse.clicked = false;
      return had;
    },
    takeWheel() {
      const value = wheel;
      wheel = 0;
      return value;
    },
    /** -1..1 on each axis, in screen space (screen-up is negative). */
    axes() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** Clear edges at the end of a frame: pressed() then reports only this frame. */
    endFrame() {
      edges.clear();
      mouse.clicked = false;
    },
  };
}
