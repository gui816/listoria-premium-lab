import { Camera, LoaderCircle, Mic, Plus } from "lucide-react";

/** Shared product-entry interaction for Shopping and Home inventory. */
export default function ProductEntryComposer({
  value,
  onChange,
  placeholder = "Ex.: Leite, pão, detergente…",
  inputRef,
  onFocus,
  onBlur,
  onVoice,
  onPhoto,
  busy = false,
  listening = false,
  disabled = false,
  extraControl = null,
  title = "Adicionar produtos",
  description = "Escreve, diz ou fotografa uma lista de produtos.",
  voiceTitle = "Voz",
  voiceDescription = "Diz os produtos",
  photoTitle = "Fotografia",
  photoDescription = "Fotografa uma lista",
  addLabel = "Adicionar produto"
}) {
  return (
    <div className="product-entry-composer">
      <div className="product-entry-heading">
        <div><strong>{title}</strong><small>{description}</small></div>
      </div>
      <div className="product-entry-field-row">
        <input ref={inputRef} autoComplete="off" value={value} onChange={onChange}
          onFocus={onFocus} onBlur={onBlur} placeholder={placeholder}
          aria-label={addLabel} maxLength={100}/>
        {extraControl}
        <button className="product-entry-submit" type="submit" aria-label={addLabel}
          disabled={disabled || busy || !value.trim()}>
          {busy ? <LoaderCircle size={19} className="spin"/> : <Plus size={21}/>}
        </button>
      </div>
      <div className="product-entry-actions">
        <button type="button" className={`product-entry-action${listening ? " is-listening" : ""}`}
          onClick={onVoice} disabled={busy || disabled}>
          <Mic size={21}/><strong>{listening ? "A ouvir…" : voiceTitle}</strong><small>{voiceDescription}</small>
        </button>
        <button type="button" className="product-entry-action" onClick={onPhoto} disabled={busy || disabled}>
          <Camera size={21}/><strong>{photoTitle}</strong><small>{photoDescription}</small>
        </button>
      </div>
    </div>
  );
}
