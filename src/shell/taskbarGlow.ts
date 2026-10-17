const colors = new Map<string, Promise<string>>()
export function iconGlow(source: string) {
  let result = colors.get(source)
  if (!result) {
    result = new Promise<string>(resolve => {
      const image = new Image()
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
          const context = canvas.getContext('2d', { willReadFrequently: true })!
          context.drawImage(image, 0, 0)
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
          let r = 0; let g = 0; let b = 0; let weight = 0
          for (let index = 0; index < pixels.length; index += 4) { const alpha = pixels[index + 3] / 255; if (alpha < .5) continue; r += pixels[index] * alpha; g += pixels[index + 1] * alpha; b += pixels[index + 2] * alpha; weight += alpha }
          const rgb = [r, g, b].map(value => Math.round(value / (weight || 1)))
          const maximum = Math.max(...rgb)
          resolve(maximum && (maximum - Math.min(...rgb)) / maximum >= .15 ? `rgba(${rgb.join(',')},.8)` : 'rgba(112,213,255,.8)')
        } catch { resolve('rgba(112,213,255,.8)') }
      }
      image.onerror = () => resolve('rgba(112,213,255,.8)')
      image.src = source
    })
    colors.set(source, result)
  }
  return result
}
