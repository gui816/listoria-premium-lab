import { Camera, ChevronDown, LoaderCircle, Mic, Plus } from "lucide-react";

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
  photoDescription = "Fotografa uma lista ou os produtos",
  addLabel = "Adicionar produto",
  inlineActions = false
}) {
  return (
    <div className={`product-entry-composer${inlineActions ? " product-entry-composer-classic" : ""}`}>
      <div className="product-entry-heading">
        <div><strong>{title}</strong><small>{description}</small></div>
      </div>
      <div className="product-entry-field-row">
        {inlineActions && (
          <button type="submit" className="product-entry-leading-add" aria-label={addLabel}
            disabled={disabled || busy || !value.trim()}>
            {busy ? <LoaderCircle size={22} className="spin"/> : <Plus size={27}/>}
          </button>
        )}
        <input ref={inputRef} autoComplete="off" value={value} onChange={onChange}
          onFocus={onFocus} onBlur={onBlur} placeholder={placeholder}
          aria-label={addLabel} maxLength={100}/>
        {extraControl}
        {inlineActions && <>
          <button type="button" className="product-entry-inline-action photo" onPointerDown={event => event.preventDefault()} onClick={onPhoto} disabled={busy || disabled} aria-label={photoTitle}><Camera size={22}/></button>
          <button type="button" className={`product-entry-inline-action voice${listening ? " is-listening" : ""}`} onPointerDown={event => event.preventDefault()} onClick={onVoice} disabled={busy || disabled} aria-label={listening ? "A ouvir" : voiceTitle}><Mic size={22}/></button>
        </>}
        {!inlineActions && (
          <button className="product-entry-submit" type="submit" aria-label={addLabel}
            disabled={disabled || busy || !value.trim()}>
            {busy ? <LoaderCircle size={19} className="spin"/> : <Plus size={21}/>}
          </button>
        )}
      </div>
      {!inlineActions && <div className="product-entry-actions">
        <button type="button" className={`product-entry-action${listening ? " is-listening" : ""}`}
          onClick={onVoice} disabled={busy || disabled}>
          <Mic size={21}/><strong>{listening ? "A ouvir…" : voiceTitle}</strong><small>{voiceDescription}</small>
        </button>
        <button type="button" className="product-entry-action" onClick={onPhoto} disabled={busy || disabled}>
          <Camera size={21}/><strong>{photoTitle}</strong><small>{photoDescription}</small>
        </button>
      </div>}
    </div>
  );
}
