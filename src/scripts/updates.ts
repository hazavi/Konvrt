import { api, type UpdateState } from './api';
import { isConverting, dlIsDownloading } from './state';
import { showToast } from './toast';

export async function initUpdates() {
  if (!api) return;
  const button = document.getElementById('update-button') as HTMLButtonElement;
  const status = document.getElementById('update-status')!;
  let state: UpdateState;
  function render(next: UpdateState) {
    state = next;
    button.hidden = state.status === 'disabled';
    const labels: Record<UpdateState['status'], string> = {
      idle: 'Check updates', disabled: '', checking: 'Checking…', current: 'Up to date',
      available: `Get v${state.version}`, downloading: `${state.percent ?? 0}%`,
      ready: 'Restart & update', installing: 'Restarting…', error: 'Retry update',
    };
    button.textContent = labels[state.status];
    button.disabled = ['checking', 'downloading', 'installing'].includes(state.status);
    button.title = state.error ?? (state.status === 'ready' ? `Install v${state.version} and restart Konvrt` : 'Check GitHub for a newer release');
    status.textContent = state.error ?? (state.status === 'available' ? `Konvrt ${state.version} is available.` : state.status === 'ready' ? 'Update downloaded. Ready to restart.' : '');
  }
  api.onUpdateState(render);
  button.addEventListener('click', async () => {
    try {
      if (state.status === 'ready') {
        if (isConverting || dlIsDownloading) {
          showToast('Update ready', 'Finish the current operation before restarting.', 'error');
          return;
        }
        const result = await api!.updateInstall();
        if (!result.success) showToast('Update', result.error ?? 'Could not install update.', 'error');
      } else render(await (state.status === 'available' ? api!.updateDownload() : api!.updateCheck()));
    } catch { showToast('Update', 'Could not check for updates. Try again.', 'error'); }
  });
  try { render(await api.updateStatus()); } catch { button.hidden = true; }
}
