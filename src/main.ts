import './styles.css';
import { AquariumController } from './app/controller';
import { AquariumScene } from './render/scene';
import { CookieSaveBackend } from './storage/saves';
import { UI } from './ui/ui';

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const stage = document.getElementById('stage')!;
const uiRoot = document.getElementById('ui')!;

if (!webglAvailable()) {
  uiRoot.innerHTML =
    '<div class="overlay"><div class="modal glass"><h2>WebGL needed</h2><p class="muted">Digital Aquarium renders in 3D and needs WebGL. Try a recent version of Chrome, Edge, Firefox or Safari.</p></div></div>';
} else {
  const ctrl = new AquariumController(new CookieSaveBackend());
  const scene = new AquariumScene(stage, ctrl);
  const ui = new UI(uiRoot, ctrl, scene);
  ui.showTitle();
  if (import.meta.env.DEV) Object.assign(window, { __daq: { ctrl, scene, ui } });
  scene.start();

  // Save when the tab hides or closes; catch up when it comes back.
  document.addEventListener('visibilitychange', () => {
    if (!ctrl.loaded) return;
    if (document.hidden) ctrl.flush();
    else ctrl.tick();
  });
  window.addEventListener('pagehide', () => ctrl.loaded && ctrl.flush());

  // Secret: the keeper console is also reachable from devtools.
  //   aquarium('skip')   aquarium('warp 2h')   aquarium('help')
  (window as unknown as { aquarium: (cmd: string) => string }).aquarium = (cmd: string) => {
    const res = ctrl.command(cmd);
    const text = res.lines.join('\n');
    console.log(text);
    return text;
  };
}
