import { onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'

interface UpdateStatusEvent {
  status: string
  version?: string
  progress?: number
  error?: string
}

export const useAutoUpdater = (): void => {
  const handleStatus = (event: UpdateStatusEvent): void => {
    switch (event.status) {
      case 'available':
        toast('Update Available', {
          description: `Version ${event.version} is available.`,
          action: {
            label: 'Download',
            onClick: () => window.api.updater.downloadUpdate()
          },
          duration: 10000
        })
        break

      case 'downloading':
        toast('Downloading Update', {
          description: `Downloading version ${event.version}...`,
          duration: Infinity,
          id: 'update-downloading'
        })
        break

      case 'downloaded':
        toast.dismiss('update-downloading')
        toast('Update Downloaded', {
          description: `Version ${event.version} is ready to install.`,
          action: {
            label: 'Install Now',
            onClick: () => window.api.updater.installUpdate()
          },
          cancel: {
            label: 'Later',
            onClick: () => {}
          },
          duration: Infinity
        })
        break

      case 'error':
        if (event.error) {
          toast.error('Update Error', {
            description: event.error
          })
        }
        break
    }
  }

  onMounted(() => {
    window.api.updater.onStatus(handleStatus)
  })

  onUnmounted(() => {
    window.api.updater.removeListener()
  })
}
