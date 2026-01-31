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

      case 'downloaded':
        toast('Update Ready', {
          description: `Version ${event.version} has been downloaded.`,
          action: {
            label: 'Restart',
            onClick: () => window.api.updater.installUpdate()
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
