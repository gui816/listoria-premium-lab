import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowRight, Camera, ChefHat, Clock3, ImagePlus, LoaderCircle, RefreshCw, ShoppingBasket, Sparkles, Utensils, WandSparkles, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";

const COPY = {
  pt: {
    eyebrow:"COZINHAR COM O QUE JÁ TENS", title:"O que vamos cozinhar hoje?",
    intro:"A Listoria usa o que tens em casa para sugerir refeições práticas, reduzir desperdício e preparar o que falta comprar.",
    prompt:"Ex.: algo rápido, sem forno, vegetariano…", generate:"Sugerir receitas", generating:"A analisar e preparar receitas…", photoTitle:"Fotografias dos teus ingredientes", photoHint:"Fotografa o frigorífico, a despensa ou os ingredientes.", takePhoto:"Tirar foto", choosePhotos:"Galeria", photoLimit:"Até 3 fotografias por pesquisa", removePhoto:"Remover fotografia", photoTooMany:"Podes adicionar no máximo 3 fotografias.", photoError:"Não foi possível preparar uma das fotografias. Tenta outra imagem.",
    inventory:"A tua despensa", inventoryCount:"produtos disponíveis", empty:"Ainda não tens produtos registados em casa.",
    emptyHint:"Adiciona alguns produtos em Em casa e a Listoria consegue sugerir receitas muito mais úteis.",
    goInventory:"Abrir Em casa", suggestions:"Experimenta pedir", quick:["Uma refeição rápida","Aproveitar o que está a acabar","Uma opção económica"],
    results:"Sugestões para ti", min:"min", servings:"doses", available:"Já tens", missing:"Falta comprar",
    ingredients:"Ingredientes", steps:"Preparação", addMissing:"Adicionar ingredientes em falta", added:"adicionados à lista de compras",
    noMissing:"Já tens tudo o que precisas!", retry:"Tentar novamente", error:"Não foi possível gerar receitas. Tenta novamente.",
    note:"As quantidades são sugestões. Confirma sempre alergénios e restrições alimentares nos rótulos dos produtos.",
    loadingInventory:"A carregar a tua despensa…", noResults:"Não recebemos sugestões válidas. Tenta reformular o pedido.",
    allAdded:"Ingredientes adicionados à tua lista."
  },
  en: {
    eyebrow:"COOK WITH WHAT YOU HAVE", title:"What shall we cook today?",
    intro:"Listoria uses what you already have to suggest practical meals, reduce waste and prepare anything missing from your shopping list.",
    prompt:"E.g. quick meal, no oven, vegetarian…", generate:"Suggest recipes", generating:"Analysing and preparing recipes…", photoTitle:"Photos of your ingredients", photoHint:"Take photos of your fridge, pantry or ingredients.", takePhoto:"Take photo", choosePhotos:"Gallery", photoLimit:"Up to 3 photos per search", removePhoto:"Remove photo", photosSelected:"photos selected", photoTooMany:"You can add up to 3 photos.", photoError:"Couldn’t prepare one of the photos. Try another image.",
    inventory:"Your pantry", inventoryCount:"available products", empty:"You haven't added products to Home yet.",
    emptyHint:"Add a few products in Home and Listoria can make much more useful suggestions.",
    goInventory:"Open Home", suggestions:"Try asking", quick:["A quick meal","Use items nearing expiry","A budget-friendly option"],
    results:"Suggestions for you", min:"min", servings:"servings", available:"You have", missing:"Need to buy",
    ingredients:"Ingredients", steps:"Method", addMissing:"Add missing ingredients", added:"added to your shopping list",
    noMissing:"You already have everything you need!", retry:"Try again", error:"Couldn't generate recipes. Please try again.",
    note:"Quantities are suggestions. Always check product labels for allergens and dietary restrictions.",
    loadingInventory:"Loading your pantry…", noResults:"No valid suggestions were returned. Try rephrasing your request.",
    allAdded:"Ingredients added to your list."
  },
  es: {
    eyebrow:"COCINA CON LO QUE YA TIENES", title:"¿Qué cocinamos hoy?",
    intro:"Listoria utiliza lo que tienes en casa para sugerir comidas prácticas, reducir el desperdicio y preparar lo que falta.",
    prompt:"Ej.: algo rápido, sin horno, vegetariano…", generate:"Sugerir recetas", generating:"Analizando y preparando recetas…", photoTitle:"Fotos de tus ingredientes", photoHint:"Fotografía tu frigorífico, despensa o ingredientes.", takePhoto:"Hacer foto", choosePhotos:"Galería", photoLimit:"Hasta 3 fotos por búsqueda", removePhoto:"Eliminar foto", photoTooMany:"Puedes añadir un máximo de 3 fotos.", photoError:"No se pudo preparar una de las fotos. Prueba otra imagen.",
    inventory:"Tu despensa", inventoryCount:"productos disponibles", empty:"Todavía no has añadido productos en Casa.",
    emptyHint:"Añade algunos productos en Casa para recibir sugerencias más útiles.",
    goInventory:"Abrir Casa", suggestions:"Prueba a pedir", quick:["Una comida rápida","Aprovechar productos próximos a caducar","Una opción económica"],
    results:"Sugerencias para ti", min:"min", servings:"raciones", available:"Ya tienes", missing:"Falta comprar",
    ingredients:"Ingredientes", steps:"Preparación", addMissing:"Añadir ingredientes que faltan", added:"añadidos a la lista",
    noMissing:"¡Ya tienes todo lo que necesitas!", retry:"Intentar de nuevo", error:"No se pudieron generar recetas.",
    note:"Las cantidades son orientativas. Comprueba siempre los alérgenos y las restricciones alimentarias.",
    loadingInventory:"Cargando tu despensa…", noResults:"No se recibieron sugerencias válidas.",
    allAdded:"Ingredientes añadidos a tu lista."
  }
};

export default function RecipesAssistant({ shareCode, language = "pt-PT", onGoInventory, onAddToShopping }) {
  const lang = language.toLowerCase().startsWith("en") ? "en" : language.toLowerCase().startsWith("es") ? "es" : "pt";
  const t = COPY[lang];
  const photoLimitText = (label, remaining) => label + (remaining > 0 ? ` · ${remaining} ${lang === "en" ? "remaining" : lang === "es" ? "disponibles" : "disponíveis"}` : "");
  const [inventory, setInventory] = useState([]);
  const [inventoryBusy, setInventoryBusy] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [expanded, setExpanded] = useState(0);
  const [added, setAdded] = useState({});
  const [notice, setNotice] = useState("");

  const loadInventory = useCallback(async () => {
    if (!shareCode) { setInventory([]); setInventoryBusy(false); return; }
    setInventoryBusy(true);
    setInventoryError("");
    const { data, error: rpcError } = await supabase.rpc("get_family_inventory", { p_share_code: shareCode });
    if (rpcError) setInventoryError(rpcError.message || t.error);
    else setInventory(Array.isArray(data?.items) ? data.items : []);
    setInventoryBusy(false);
  }, [shareCode, t.error]);

  useEffect(() => { void loadInventory(); }, [loadInventory]);

  const inventorySummary = useMemo(() => inventory.map(item => ({
    name: String(item.name || "").trim(),
    quantity: Math.max(0, Number(item.quantity) || 0),
    location: item.storage_location || item.location || "",
    expiryDate: item.expiry_date || null
  })).filter(item => item.name).slice(0, 60), [inventory]);

  async function preparePhoto(file) {
    if (!file.type.startsWith("image/")) throw new Error(t.photoError);
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error(t.photoError);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(t.photoError)), "image/jpeg", 0.76));
    if (!blob || blob.size > 700 * 1024) throw new Error(t.photoError);
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(t.photoError));
      reader.readAsDataURL(blob);
    });
    return { name: file.name, preview: dataUrl, mimeType: "image/jpeg", data: dataUrl.split(",")[1] || "" };
  }

  async function handlePhotoSelection(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;
    setPhotoError("");
    if (photoFiles.length + selected.length > 3) {
      setPhotoError(t.photoTooMany);
      return;
    }
    setPhotoBusy(true);
    try {
      const prepared = [];
      for (const file of selected) prepared.push(await preparePhoto(file));
      setPhotoFiles(previous => [...previous, ...prepared].slice(0, 3));
    } catch {
      setPhotoError(t.photoError);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function generateRecipes(request = prompt) {
    if (busy) return;
    setBusy(true); setError(""); setNotice(""); setAdded({});
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("listora-recipe-assistant", {
        body: { inventory: inventorySummary, request: String(request || "").trim().slice(0, 500), language, images: photoFiles.map(({ mimeType, data }) => ({ mimeType, data })) }
      });
      if (invokeError) {
        let message = invokeError.message || t.error;
        try {
          const response = invokeError.context;
          if (response && typeof response.json === "function") {
            const body = await response.json();
            message = body?.error || body?.message || message;
          }
        } catch { /* Keep the original error. */ }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      const found = (Array.isArray(data?.recipes) ? data.recipes : []).slice(0, 3).map((recipe, index) => ({
        id: String(recipe.id || index),
        title: String(recipe.title || "").slice(0, 90),
        description: String(recipe.description || "").slice(0, 220),
        timeMinutes: Math.max(5, Math.min(240, Number(recipe.timeMinutes) || 30)),
        servings: Math.max(1, Math.min(12, Number(recipe.servings) || 2)),
        ingredients: (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).slice(0, 24).map(item => ({
          name: String(item.name || "").trim().slice(0, 100),
          quantity: String(item.quantity || "").slice(0, 50),
          available: item.available === true
        })).filter(item => item.name),
        steps: (Array.isArray(recipe.steps) ? recipe.steps : []).map(step => String(step).trim().slice(0, 500)).filter(Boolean).slice(0, 8),
        tip: String(recipe.tip || "").slice(0, 220)
      })).filter(recipe => recipe.title && recipe.ingredients.length && recipe.steps.length);
      if (!found.length) throw new Error(t.noResults);
      setRecipes(found); setExpanded(0);
    } catch (err) {
      setError(err.message || t.error);
    } finally {
      setBusy(false);
    }
  }

  async function addMissing(recipe, recipeIndex) {
    const missing = recipe.ingredients.filter(item => !item.available);
    if (!missing.length || added[recipe.id] || !onAddToShopping) return;
    setAdded(previous => ({ ...previous, [recipe.id]: true }));
    try {
      for (const item of missing) {
        const rawQuantity = item.quantity.trim();
        const parsed = /^\d+(?:[.,]\d+)?$/.test(rawQuantity) ? Number.parseFloat(rawQuantity.replace(",", ".")) : 1;
        await onAddToShopping({ name: item.name, quantity: Number.isFinite(parsed) && parsed > 0 ? Math.min(999, Math.ceil(parsed)) : 1, category: "auto" });
      }
      setNotice(lang === "en" ? missing.length + " ingredients added to your shopping list." : lang === "es" ? missing.length + " ingredientes añadidos a tu lista." : missing.length + " ingredientes adicionados à tua lista de compras.");
    } catch {
      setAdded(previous => ({ ...previous, [recipe.id]: false }));
      setError(t.error);
    }
  }

  return <section className="recipes-assistant">
    <header className="recipes-assistant-hero">
      <div className="recipes-assistant-hero-icon"><ChefHat size={25}/><Sparkles size={14}/></div>
      <span className="eyebrow">{t.eyebrow}</span>
      <h1>{t.title}</h1>
      <p>{t.intro}</p>
    </header>

    <div className="recipes-pantry-strip">
      <div className="recipes-pantry-top"><div><span className="recipes-section-kicker">{t.inventory}</span><strong>{inventoryBusy ? "…" : inventorySummary.length}</strong></div><span>{t.inventoryCount}</span><button type="button" onClick={loadInventory} disabled={inventoryBusy} aria-label={t.retry}><RefreshCw size={15} className={inventoryBusy ? "spin" : ""}/></button></div>
      {inventoryBusy ? <div className="recipes-pantry-loading"><LoaderCircle size={15} className="spin"/>{t.loadingInventory}</div> : inventorySummary.length ? <div className="recipes-pantry-chips">{inventorySummary.slice(0, 8).map((item, index) => <span key={index}>{item.name}{item.quantity > 1 ? " · " + item.quantity : ""}</span>)}{inventorySummary.length > 8 && <small>+{inventorySummary.length - 8}</small>}</div> : <div className="recipes-pantry-empty"><p>{t.empty}</p><small>{t.emptyHint}</small><button type="button" onClick={onGoInventory}>{t.goInventory} <ArrowRight size={15}/></button></div>}
    </div>

    <div className="recipes-ai-composer">
      <label htmlFor="recipes-request">{t.suggestions}</label>
      <div className="recipes-quick-prompts">{t.quick.map(value => <button type="button" key={value} onClick={() => { setPrompt(value); void generateRecipes(value); }} disabled={busy}>{value}</button>)}</div>
      <textarea id="recipes-request" rows={2} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder={t.prompt} maxLength={500}/>
      <div className="recipes-photo-picker">
        <div className="recipes-photo-picker-copy"><strong>{t.photoTitle}</strong><small>{t.photoHint}</small></div>
        <div className="recipes-photo-picker-actions">
          <label className="recipes-photo-action" htmlFor="recipes-camera"><Camera size={17}/>{t.takePhoto}</label>
          <label className="recipes-photo-action" htmlFor="recipes-gallery"><ImagePlus size={17}/>{t.choosePhotos}</label>
          <input id="recipes-camera" className="recipes-photo-input" type="file" accept="image/*" capture="environment" onChange={handlePhotoSelection}/>
          <input id="recipes-gallery" className="recipes-photo-input" type="file" accept="image/*" multiple onChange={handlePhotoSelection}/>
        </div>
        <small className="recipes-photo-limit">{photoLimitText(t.photoLimit, 3 - photoFiles.length)}</small>
        {photoBusy && <p className="recipes-photo-status"><LoaderCircle size={14} className="spin"/>{t.generating}</p>}
        {photoFiles.length > 0 && <div className="recipes-photo-previews">{photoFiles.map((photo, index) => <div className="recipes-photo-preview" key={`${photo.name}-${index}`}><img src={photo.preview} alt={photo.name}/><button type="button" onClick={() => setPhotoFiles(previous => previous.filter((_, photoIndex) => photoIndex !== index))} aria-label={t.removePhoto}><X size={14}/></button></div>)}</div>}
        {photoError && <p className="recipes-error" role="alert">{photoError}</p>}
      </div>
      <button type="button" className="recipes-generate-button" onClick={() => generateRecipes()} disabled={busy || photoBusy || inventoryBusy || (!inventorySummary.length && !prompt.trim() && !photoFiles.length)}>
        {busy ? <><LoaderCircle size={18} className="spin"/>{t.generating}</> : <><WandSparkles size={18}/>{t.generate}</>}
      </button>
      {inventoryError && <p className="recipes-error" role="alert">{inventoryError}</p>}
      {error && <p className="recipes-error" role="alert">{error}</p>}
    </div>

    {notice && <p className="recipes-success" role="status">{notice}</p>}
    {recipes.length > 0 && <div className="recipes-results">
      <div className="recipes-results-heading"><div><span className="eyebrow">{t.results}</span><h2>{recipes.length} {lang === "en" ? "ideas" : lang === "es" ? "ideas" : "ideias"}</h2></div><button type="button" onClick={() => generateRecipes()} disabled={busy}><RefreshCw size={15}/>{t.retry}</button></div>
      {recipes.map((recipe, index) => {
        const missing = recipe.ingredients.filter(item => !item.available);
        const isOpen = expanded === index;
        return <article className={`recipe-ai-card${isOpen ? " expanded" : ""}`} key={recipe.id}>
          <button type="button" className="recipe-ai-card-toggle" onClick={() => setExpanded(isOpen ? -1 : index)} aria-expanded={isOpen}>
            <span className="recipe-ai-number">{index + 1}</span>
            <span className="recipe-ai-card-title"><strong>{recipe.title}</strong><small>{recipe.description}</small><span className="recipe-ai-meta"><span><Clock3 size={14}/>{recipe.timeMinutes} {t.min}</span><span><Utensils size={14}/>{recipe.servings} {t.servings}</span></span></span>
            <ArrowRight size={18} className={isOpen ? "recipe-ai-chevron open" : "recipe-ai-chevron"}/>
          </button>
          {isOpen && <div className="recipe-ai-details">
            <div className="recipe-ai-ingredient-heading"><strong>{t.ingredients}</strong><span>{recipe.ingredients.filter(item => item.available).length} {t.available.toLowerCase()} · {missing.length} {t.missing.toLowerCase()}</span></div>
            <ul className="recipe-ai-ingredients">{recipe.ingredients.map((item, itemIndex) => <li key={itemIndex}><span className={item.available ? "ingredient-available" : "ingredient-missing"}>{item.available ? "✓" : "+"}</span><span>{item.name}</span><small>{item.quantity}</small></li>)}</ul>
            <h3>{t.steps}</h3>
            <ol className="recipe-ai-steps">{recipe.steps.map((step, stepIndex) => <li key={stepIndex}>{step}</li>)}</ol>
            {recipe.tip && <p className="recipe-ai-tip"><Sparkles size={14}/>{recipe.tip}</p>}
            <button type="button" className="recipe-ai-add-button" disabled={!missing.length || added[recipe.id]} onClick={() => void addMissing(recipe, index)}>
              {added[recipe.id] ? <><ArrowDownToLine size={17}/>{t.allAdded}</> : missing.length ? <><ShoppingBasket size={17}/>{t.addMissing} ({missing.length})</> : <><ChefHat size={17}/>{t.noMissing}</>}
            </button>
          </div>}
        </article>;
      })}
    </div>}
    <p className="recipes-ai-note"><Sparkles size={13}/>{t.note}</p>
  </section>;
}
