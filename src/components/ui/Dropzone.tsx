import { useCallback, useState, type ChangeEvent, type DragEvent } from 'react'
import { UploadCloud, X, ImageIcon } from 'lucide-react'

interface DropzoneProps {
  value:    File | null
  onChange: (file: File | null) => void
  error?:   string
  accept?:  string
  maxSizeMB?: number
}

export function Dropzone({
  value,
  onChange,
  error,
  accept = 'image/jpeg,image/png,image/webp,image/heic',
  maxSizeMB = 5,
}: DropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)

  const previewUrl = value ? URL.createObjectURL(value) : null

  function validate(file: File): boolean {
    if (file.size > maxSizeMB * 1024 * 1024) {
      setSizeError(`Arquivo muito grande. Máximo: ${maxSizeMB} MB`)
      return false
    }
    setSizeError(null)
    return true
  }

  const handleFile = useCallback((file: File | null) => {
    if (!file) { onChange(null); return }
    if (validate(file)) onChange(file)
  }, [onChange])

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0] ?? null)
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0] ?? null)
  }

  function onDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragging(true)
  }

  const displayError = sizeError ?? error

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Foto (opcional)
      </span>

      {previewUrl ? (
        /* Preview da imagem */
        <div className="relative rounded-xl overflow-hidden border border-white/40 dark:border-white/10 bg-slate-100 dark:bg-white/5">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full max-h-64 object-cover"
          />
          <button
            type="button"
            onClick={() => { onChange(null); setSizeError(null) }}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/60 text-white
                       hover:bg-rose-600/80 transition-colors"
          >
            <X size={16} />
          </button>
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-slate-900/60 text-white text-xs flex items-center gap-1.5">
            <ImageIcon size={12} />
            {value?.name}
          </div>
        </div>
      ) : (
        /* Dropzone */
        <label
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={() => setDragging(false)}
          className={[
            'flex flex-col items-center justify-center gap-3 p-8 rounded-xl cursor-pointer',
            'border-2 border-dashed transition-all duration-200',
            dragging
              ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-900/20'
              : 'border-white/40 dark:border-white/10 bg-white/30 dark:bg-white/5',
            'hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10',
            displayError ? 'border-rose-400' : '',
          ].join(' ')}
        >
          <div className={[
            'p-3 rounded-xl transition-colors',
            dragging
              ? 'bg-indigo-100 dark:bg-indigo-900/50'
              : 'bg-slate-100 dark:bg-white/10',
          ].join(' ')}>
            <UploadCloud size={24} className={dragging ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {dragging ? 'Solte a imagem aqui' : 'Arraste uma foto ou clique para selecionar'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              JPG, PNG, WebP ou HEIC · Máx. {maxSizeMB} MB
            </p>
          </div>
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={onInputChange}
          />
        </label>
      )}

      {displayError && (
        <p className="text-xs text-rose-500 dark:text-rose-400">{displayError}</p>
      )}
    </div>
  )
}
