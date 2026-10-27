import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase, isSupabaseConfigured } from "./lib/supabase.js";
import {
  ArrowRight, ArrowLeft, Sparkles, Check, CheckCheck, ChevronDown, CircleHelp, Clipboard, Copy, Share2, Repeat2, Download,
  Camera, Mic, Leaf, LoaderCircle, Plus, ShoppingBasket, Trash2, Users, LogOut, Wifi, WifiOff, X, FileText, Receipt, Upload, ExternalLink, Zap, Smartphone, Bell
} from "lucide-react";

const CATEGORIES = [
  { id: "all", label: "Tudo", emoji: "🛒" },
  { id: "fruta", label: "Fruta e legumes", emoji: "🥑" },
  { id: "frescos", label: "Frescos", emoji: "🥛" },
  { id: "despensa", label: "Despensa", emoji: "🥫" },
  { id: "limpeza", label: "Limpeza", emoji: "🧽" },
  { id: "outros", label: "Outros", emoji: "📦" }
];

function guessCategory(name) {
  const n = name.toLocaleLowerCase("pt-PT");
  if (/maçã|banana|laranja|pera|uva|morango|tomate|alface|cebola|batata|cenoura|courgette|pepino|fruta|legume|abacate|limão/.test(n)) return "fruta";
  if (/leite|iogurte|queijo|manteiga|ovo|ovos|natas|fiambre|carne|frango|peixe|salmão|presunto/.test(n)) return "frescos";
  if (/arroz|massa|atum|feijão|grão|farinha|açúcar|café|chá|azeite|óleo|cereais|bolacha|pão|conserva|molho/.test(n)) return "despensa";
  if (/detergente|lixívia|esponja|papel higiénico|papel de cozinha|saco do lixo|limpeza|lava-loiça|sabão/.test(n)) return "limpeza";
  return "outros";
}


const LANGUAGE_OPTIONS = [
  ["pt-PT", "Português (Portugal)"], ["en", "English"], ["es", "Español"],
  ["fr", "Français"], ["de", "Deutsch"], ["it", "Italiano"], ["nl", "Nederlands"],
  ["pl", "Polski"], ["ro", "Română"], ["zh-CN", "简体中文"]
];
const I18N = {
en: {
"Adicionar produto…":"Add a product…","Tira uma fotografia a uma lista manuscrita, quadro ou papel. A Listora reconhece os produtos automaticamente.":"Take a photo of a handwritten list, whiteboard or paper. Listora recognises the products automatically.","Ou toca no microfone e diz vários produtos de seguida.":"Or tap the microphone and say several items in a row.","O reconhecimento de voz não é suportado neste navegador. Toca no campo do produto e usa o microfone do teclado para ditar.":"Voice recognition is not supported in this browser. Tap the product field and use your keyboard microphone to dictate.","O acesso ao microfone foi recusado. Permite o microfone nas definições do navegador.":"Microphone access was denied. Allow microphone access in your browser settings.","O reconhecimento de voz precisa de uma ligação à Internet. Verifica a ligação e tenta novamente.":"Voice recognition needs an internet connection. Check your connection and try again.","Não detetámos voz. Toca no microfone e fala depois de aparecer a indicação de escuta.":"We couldn't hear you. Tap the microphone and speak when listening starts.","Não foi possível reconhecer a voz. Neste navegador, podes usar o microfone do teclado para ditar no campo do produto.":"Voice recognition failed. In this browser, use your keyboard microphone to dictate in the product field.","Não percebemos os produtos ditos. Tenta falar um pouco mais devagar.":"We couldn't understand the items. Try speaking a little more slowly.","Não foi detetada voz. Tenta novamente.":"No speech was detected. Please try again.","Sugestões rápidas":"Quick suggestions","Manuscrito, quadro ou papel":"Handwritten, whiteboard or paper","Por voz":"By voice","Dita os produtos":"Dictate items","Fotografar lista":"Photograph list","Importar lista por imagem":"Import list from image","Escolher câmara ou ficheiro":"Choose camera or file","Abrir câmara":"Open camera","Fotografar uma lista de compras em papel, manuscrita ou num quadro.":"Take a photo of a shopping list on paper, handwritten, or on a whiteboard.","Escolher uma fotografia de uma lista de compras.":"Choose a photo of a shopping list.","Fotografa uma lista de compras em papel, manuscrita ou num quadro. Também podes dizer vários produtos por voz; confirma os artigos reconhecidos antes de os adicionar.":"Take a photo of a shopping list on paper, handwritten, or on a whiteboard. You can also say several items aloud; review the recognised items before adding them.","Ativa o modo supermercado para veres apenas o que falta comprar. Podes repetir compras, guardar listas habituais e guardar as faturas das tuas compras para as consultar mais tarde.":"Use supermarket mode to focus on items you still need. You can repeat purchases, save regular lists, and save shopping receipts to consult later.","Câmara ou galeria":"Camera or gallery","Escolher da galeria":"Choose from gallery","Foste convidado para uma lista partilhada":"You have been invited to a shared list","Foste convidado para":"You have been invited to","Indica o teu nome para poderes criar a lista.":"Enter your name to create the list.","Indica o teu nome para entrares na lista.":"Enter your name to join the list.","Para instalar, abre o menu do navegador e escolhe ‘Instalar aplicação’ ou ‘Adicionar ao ecrã principal’.":"To install, open your browser menu and choose ‘Install app’ or ‘Add to Home screen’.",
"Instalar agora":"Install now","Lista otimizada para comprar na loja":"A list optimised for shopping in-store",
"O Chrome ainda não disponibilizou a instalação automática. Abre o menu ⋮ e procura ‘Instalar Listora’ ou usa o ícone de instalação na barra de endereço. Se não aparecer, verifica a instalação em chrome://web-app-internals.":"Chrome has not made automatic installation available yet. Open the ⋮ menu and look for ‘Install Listora’, or use the install icon in the address bar. If it is missing, check installation status in chrome://web-app-internals.",
"Este navegador não disponibilizou a instalação automática. Abre o menu do navegador e procura ‘Instalar aplicação’ ou ‘Adicionar ao ecrã principal’.":"This browser has not made automatic installation available. Open the browser menu and look for ‘Install app’ or ‘Add to Home screen’.",
"Não foi possível abrir a instalação automática. Usa o menu do navegador para instalar a Listora.":"Automatic installation could not be opened. Use the browser menu to install Listora.","Lista de compras":"Shopping list","Faturas":"Receipts","Adicionar artigos rapidamente":"Add items faster","ADICIONAR MAIS RÁPIDO":"ADD ITEMS FASTER","Importa uma lista com uma fotografia":"Import a list from a photo","Diz vários produtos por voz":"Say several items aloud","Guarda as faturas das compras":"Save shopping receipts","Tira uma fotografia a uma lista de compras manuscrita, escrita num papel ou num quadro. A inteligência artificial analisa a imagem, identifica os produtos e prepara uma lista para reveres antes de adicionar.":"Take a photo of a handwritten shopping list on paper or a whiteboard. AI analyses the image, identifies the items, and prepares a list for you to review before adding.","Diz vários produtos de seguida, como leite, pão e seis ovos. A inteligência artificial interpreta a voz e transforma o que dizes em produtos para confirmares antes de adicionar.":"Say several items in a row, such as milk, bread and six eggs. AI interprets your speech and turns it into items for you to confirm before adding.","Fotografa as faturas das tuas compras para as guardar na Listora e consultá-las mais tarde. Também podes repetir compras e guardar listas habituais.":"Take photos of your shopping receipts to save them in Listora and consult them later. You can also repeat purchases and save regular lists.","Anterior":"Previous","Descobrir":"Discover","Partilhar com família e amigos":"Share with family and friends","Descobre tudo o que a Listora pode fazer":"Discover everything Listora can do","Fotografia e voz com IA, listas partilhadas, faturas e muito mais.":"AI photo and voice, shared lists, receipts and more.","Voltar à página inicial":"Back to home","CONHECE A LISTORA":"DISCOVER LISTORA","Mais simples e inteligentes.":"Simpler and smarter.","A Listora ajuda a organizar as compras de toda a família num só lugar: da lista partilhada às fotografias, voz e faturas, com ajuda da inteligência artificial.":"Listora helps your family organise shopping in one place—from shared lists to photos, voice and receipts, with help from AI.","FOTOGRAFIA + IA":"PHOTO + AI","Uma fotografia. Uma lista pronta a rever.":"One photo. A list ready to review.","Fotografa uma lista manuscrita, uma folha de papel ou um quadro. A inteligência artificial analisa a imagem e identifica os produtos para confirmares antes de adicionar.":"Photograph a handwritten list, a sheet of paper or a whiteboard. AI analyses the image and identifies items for you to confirm before adding.","VOZ + IA":"VOICE + AI","Diz vários produtos de seguida.":"Say several items in a row.","Diz, por exemplo, «leite, pão e seis ovos». A inteligência artificial interpreta a voz e prepara os produtos para reveres e adicionares à lista.":"Say, for example, “milk, bread and six eggs”. AI interprets your speech and prepares items for you to review and add.","FATURAS":"RECEIPTS","Guarda as faturas das compras.":"Save your shopping receipts.","Fotografa as faturas para as guardar na Listora e consultar mais tarde. Os dados que possam ser extraídos por reconhecimento automático devem ser revistos quando necessário.":"Photograph receipts to save them in Listora and consult them later. Any data extracted automatically should be reviewed when needed.","EM FAMÍLIA":"AS A FAMILY","Todos contribuem para a mesma lista.":"Everyone contributes to the same list.","Convida a família e mantém a lista partilhada atualizada para que todos saibam o que falta comprar.":"Invite your family and keep the shared list updated so everyone knows what needs to be bought.","NO SUPERMERCADO":"AT THE SUPERMARKET","Compra com mais foco.":"Shop with more focus.","Usa o modo supermercado para acompanhar o que já foi comprado e o que falta. É especialmente útil quando várias pessoas fazem compras em simultâneo, porque todos podem acompanhar a mesma lista atualizada.":"Use supermarket mode to track what has been bought and what is still needed. It is especially useful when several people shop at the same time, as everyone can follow the same up-to-date list.","ROTINAS MAIS SIMPLES":"SIMPLER ROUTINES","Repete compras habituais.":"Repeat regular shopping.","Guarda listas reutilizáveis e recupera compras frequentes sem ter de começar sempre do zero.":"Save reusable lists and bring back frequent purchases without starting from scratch.","Lista guardada":"Saved list","Sincronizada":"Synced","Inteligência artificial com confirmação tua.":"AI, with your confirmation.","A IA ajuda a interpretar imagens e voz, mas pode cometer erros. Revê os resultados antes de os adicionares à lista ou utilizares informação extraída de uma fatura.":"AI helps interpret images and speech, but it can make mistakes. Review results before adding them to your list or using information extracted from a receipt.","Vamos organizar as compras?":"Ready to organise your shopping?","Cria uma lista e começa a usar a Listora com a tua família.":"Create a list and start using Listora with your family.","Conhecer todas as funcionalidades":"Explore all features","Partilhar":"Share","Partilhar a Listora com amigos":"Share Listora with friends","Descobre a Listora: organiza as compras da família numa lista partilhada.":"Discover Listora: organise your family shopping in one shared list.","Link da Listora copiado! Partilha com os teus amigos.":"Listora link copied! Share it with your friends.","Copia este link para partilhar a Listora com os teus amigos:":"Copy this link to share Listora with your friends:","Fotografa uma lista em papel ou dita os produtos":"Photograph a paper list or dictate items","Sair":"Exit","AS TUAS COMPRAS":"YOUR SHOPPING","Tudo comprado!":"All done!","Vamos às compras":"Let's go shopping","Progresso das compras":"{done} of {total} items checked","Comprados":"Purchased","Por comprar":"To buy","produtos na lista":"products on the list","Desliza para ver":"Scroll to view","Fechar aviso":"Dismiss hint","ARQUIVO PARTILHADO":"SHARED ARCHIVE","Antes de guardar, como te devemos identificar?":"Before saving, what name should we use?","Ex.: compras da semana, IVA, descontos…":"E.g. weekly shopping, VAT, discounts…","A analisar a fatura automaticamente…":"Analyzing receipt automatically…","A IA tenta identificar o supermercado, a data, o total, o IVA e os artigos. Revê sempre as sugestões antes de guardar.":"AI will try to identify the store, date, total, VAT and items. Review suggestions before saving.","Sugestões extraídas — confirma os campos acima":"Suggestions extracted — review the fields above","IVA identificado":"VAT identified","Artigos identificados":"Items identified","Guardar fatura":"Save receipt","fatura":"receipt","faturas":"receipts","Adiciona o primeiro comprovativo para ficar disponível a toda a família.":"Add the first receipt to make it available to the whole family.","Ficheiro selecionado":"File selected","Fotografia ou PDF · até 10 MB":"Photo or PDF · up to 10 MB","Carregar ficheiro":"Upload file","A analisar…":"Analyzing…","A analisar a fatura com IA…":"Analyzing receipt with AI…","A identificar o supermercado, a data, o total, o IVA e os artigos. Isto pode demorar alguns segundos.":"Identifying the store, date, total, VAT and items. This may take a few seconds.","Não feches esta página. Vamos preencher os campos automaticamente para confirmares antes de guardar.":"Keep this page open. We’ll fill in the fields automatically for you to review before saving.","Criar nova":"Create new","Foste convidado para uma lista partilhada":"You've been invited to a shared list","CONVITE PARA UMA LISTA":"LIST INVITATION","A verificar o convite…":"Checking invitation…","Queres entrar nesta lista e partilhar as compras com a família?":"Would you like to join this list and share shopping with your family?","O código do convite já está preenchido. Confirma o teu nome para entrar.":"The invitation code is already filled in. Enter your name to join.","Não, obrigado":"No, thanks","Foste convidado para":"You have been invited to","Foste convidado para uma lista partilhada":"You have been invited to a shared list","Foste convidado para uma lista partilhada":"You have been invited to a shared list","Escreve o teu nome":"Enter your name","Foste convidado para uma lista partilhada":"You have been invited to a shared list","A entrar…":"Joining…","Foste convidado para uma lista partilhada":"You have been invited to a shared list","O teu nome":"Your name","Ex.: Guilherme":"E.g. Alex","Criar uma lista nova":"Create a new list","Começa uma lista e convida a família.":"Start a list and invite your family.","Instalar a Listora no iPhone":"Install Listora on iPhone","No Safari, toca em Partilhar na barra do navegador e escolhe «Adicionar ao ecrã principal». Depois toca em Adicionar.":"In Safari, tap Share in the browser toolbar, choose “Add to Home Screen”, then tap Add.","1. Toca no botão Partilhar do Safari.":"1. Tap the Share button in Safari.","2. Escolhe «Adicionar ao ecrã principal».":"2. Choose “Add to Home Screen”.","3. Confirma em Adicionar.":"3. Confirm by tapping Add.","Percebi":"Got it","Entra na lista partilhada":"Join the shared list","O convite já preencheu o código. Só falta o teu nome.":"The invitation code is filled in. Just add your name.","Entrar na lista":"Join list","Confirmar e entrar":"Confirm and join","Foste convidado para":"You've been invited to","Fotografar lista":"Photograph list","Por voz":"By voice","Dita os produtos":"Dictate items","Adicionar por imagem ou voz":"Add by photo or voice","Fotografa uma lista para reconhecer os produtos":"Take a photo of a list to recognise the items","Dita vários produtos sem escrever":"Say several items without typing","Adicionar por voz":"Add by voice","Faturas de compras":"Shopping receipts","Comprovativos acessíveis a todos os membros desta lista.":"Receipts available to everyone on this list.","Notas (opcional)":"Notes (optional)","Ex.: Continente, Lidl, Pingo Doce":"E.g. supermarket name","Anexar fotografia ou PDF":"Attach photo or PDF","Tirar fotografia ou anexar ficheiro":"Take a photo or attach a file","IVA":"VAT","Artigos identificados:":"Items identified:","O teu nome":"Your name","Listas guardadas":"Saved lists","Guardar lista atual":"Save current list","Sair da lista":"Leave list","Lista atual":"Current list","Outros":"Other","Escolhe outros produtos":"Choose other products","Toca num produto para o adicionar à lista.":"Tap a product to add it to your list.","Pesquisar produtos…":"Search products…","Carne e peixe":"Meat and fish","Pequeno-almoço e cereais":"Breakfast and cereals","Ovos":"Eggs","Frango":"Chicken","Carne picada":"Minced beef","Bifes":"Steak","Costeletas":"Pork chops","Salsichas":"Sausages","Fiambre":"Ham","Peixe":"Fish","Salmão":"Salmon","Atum":"Tuna","Camarão":"Prawns","Cereais":"Cereal","Muesli":"Muesli","Aveia":"Oats","Granola":"Granola","Iogurtes":"Yogurt","Queijo":"Cheese","Manteiga":"Butter","Margarina":"Margarine","Compota":"Jam","Mel":"Honey","Maçãs":"Apples","Laranjas":"Oranges","Tomates":"Tomatoes","Batatas":"Potatoes","Cebolas":"Onions","Alface":"Lettuce","Cenouras":"Carrots","Brócolos":"Broccoli","Abacates":"Avocados","Arroz":"Rice","Massa":"Pasta","Farinha":"Flour","Açúcar":"Sugar","Sal":"Salt","Azeite":"Olive oil","Óleo":"Cooking oil","Feijão":"Beans","Grão":"Chickpeas","Lentilhas":"Lentils","Tomate em lata":"Canned tomatoes","Caldo":"Stock cubes","Congelados":"Frozen","Legumes congelados":"Frozen vegetables","Gelado":"Ice cream","Batatas fritas congeladas":"Frozen chips","Casa e higiene":"Home and personal care","Detergente da roupa":"Laundry detergent","Detergente da loiça":"Dish soap","Papel higiénico":"Toilet paper","Papel de cozinha":"Kitchen roll","Champô":"Shampoo","Pasta de dentes":"Toothpaste","Partilhar lista":"Share list","Sair e criar nova lista":"Leave and create new list","Reconhece os produtos automaticamente":"Recognises products automatically","Carregar ficheiro":"Upload file","Escolher uma imagem do dispositivo":"Choose an image from your device","A ouvir… toca para parar":"Listening… tap to stop","Microfone ativo":"Microphone active","Podes começar a falar":"You can start speaking","A preparar microfone…":"Preparing microphone…","A identificar os produtos":"Identifying your items","Estamos a identificar os produtos que disseste. Só mais um momento.":"We’re identifying the items you said. Just a moment.","Diz vários produtos seguidos. Não precisas de fazer pausas entre cada produto.":"Say several items in a row. You don’t need to pause between each item.","Por exemplo":"For example","Leite, pão, seis ovos e dois iogurtes.":"Milk, bread, six eggs and two yogurts.","A analisar o que disseste…":"Processing what you said…","Parar gravação":"Stop recording","A processar voz…":"Processing voice…","Diz os produtos que precisas":"Say the items you need",
"Todos":"All","Tudo":"All","Fruta e legumes":"Fruit & vegetables","Frescos":"Fresh","Despensa":"Pantry","Limpeza":"Cleaning","Outros":"Other",
"Falta configurar o Supabase":"Supabase setup required","A preparar a tua lista…":"Preparing your list…","MAIS SIMPLES, JUNTOS":"SIMPLER, TOGETHER","As compras da família.":"Family shopping.","Sem esquecimentos.":"Never forget a thing.","Uma lista partilhada, sempre atualizada. Adiciona o que falta em casa e deixa o resto connosco.":"One shared list, always up to date. Add what you need at home and leave the rest to us.","Criar uma lista nova":"Create a new list","Começa uma lista e convida a família.":"Start a list and invite your family.","Nome da lista":"List name","Compras da família":"Family shopping","Criar lista":"Create list","A criar…":"Creating…","ou":"or","Já tens um código de partilha?":"Already have a sharing code?","Entrar na lista":"Join list","Feita para partilhar. Simples para todos.":"Made to share. Simple for everyone.","A tua casa, mais organizada.":"A more organised home.","Partilhar":"Share","A LISTA DA CASA":"THE HOUSEHOLD LIST","Sincronização ativa":"Sync active","A ligar":"Connecting","Sincronizada":"Synced","A ligar…":"Connecting…","O que está a faltar em casa?":"What are we running out of?","Nome do artigo":"Item name","Adicionar artigo":"Add item","Qtd.":"Qty.","Categoria":"Category","Automática":"Automatic","Filtrar por categoria":"Filter by category","Já comprados":"Purchased","Falta comprar":"To buy","artigo":"item","artigos":"items","Ver por comprar":"View items to buy","A lista está vazia":"Your list is empty","Nada nesta categoria":"Nothing in this category","Ainda não há compras concluídas":"No items purchased yet","Quando marcares um artigo como comprado, aparece aqui.":"Items marked as purchased will appear here.","Adiciona o primeiro artigo no campo acima.":"Add your first item above.","Marcar como por comprar":"Mark as not purchased","Marcar como comprado":"Mark as purchased","Limpar artigos comprados":"Clear purchased items","Queres remover todos os produtos desta lista? Esta ação afeta todos os membros e não pode ser desfeita.":"Remove every product from this list? This affects all members and cannot be undone.","Todos os produtos foram removidos":"All products were removed","Remover todos os produtos":"Remove all products","Menos esquecimentos, mais tempo juntos.":"Fewer forgotten items, more time together.","Sair da lista":"Leave list","Sair desta lista neste dispositivo? A lista partilhada não será apagada.":"Leave this list on this device? The shared list will not be deleted.","Fechar":"Close","A lista é melhor em família":"Shopping is better together","Partilha o link ou o código com quem faz as compras contigo. Todos veem as alterações em tempo real.":"Share the link or code with whoever shops with you. Everyone sees changes in real time.","CÓDIGO DA LISTA":"LIST CODE","Código da lista":"List code","Lista Família":"Listora","Partilhar código":"Share code","Partilha o código com a família. Cada pessoa introduz o código na app para abrir a mesma lista e sincronizar as alterações.":"Share the code with your family. Each person enters it in the app to open the same list and sync changes.","Qualquer pessoa com o código pode aceder à lista. Partilha apenas com pessoas de confiança.":"Anyone with the code can access this list. Only share it with people you trust.","Copiar link de convite":"Copy invite link","Copiar apenas o código":"Copy code only","Qualquer pessoa com o link ou código pode aceder à lista. Partilha apenas com pessoas de confiança.":"Anyone with the link or code can access this list. Only share it with people you trust.","Link de convite copiado!":"Invite link copied!","Código copiado. O link público ainda não está configurado.":"Code copied. The public link is not configured yet.","Código da lista copiado!":"List code copied!","Copiar código":"Copy code","Repetir compras":"Buy again","Artigo adicionado novamente":"Item added again","Listas reutilizáveis":"Reusable lists","Guardar lista atual":"Save current list","Guarda uma compra habitual para a reutilizares noutra semana.":"Save a regular shopping list to reuse next week.","Nome para esta lista reutilizável:":"Name this reusable list:","Compra semanal":"Weekly shop","Lista guardada neste dispositivo":"List saved on this device","Lista reutilizada":"List restored","Modo supermercado":"Shopping mode","Ativo":"On","Ativar":"Start","DESCOBRE A LISTORA":"DISCOVER LISTORA","A tua lista está pronta!":"Your list is ready!","Tudo o que precisas para organizar as compras, num só lugar e sempre sincronizado com a tua família.":"Everything you need to organise shopping in one place, always in sync with your family.","Adiciona o que falta em casa":"Add what you need at home","Escreve o nome de um produto ou usa as sugestões rápidas. Marca cada artigo quando o colocares no carrinho.":"Type a product name or use quick suggestions. Check off each item as you put it in your cart.","Adiciona vários produtos de uma vez":"Add several items at once","Fotografa uma lista de compras em papel, manuscrita ou num quadro. Também podes dizer vários produtos por voz; confirma os artigos reconhecidos antes de os adicionar.":"Take a photo of a paper list or dictate items by voice. Review suggestions before adding them.","Partilha com a família":"Share with your family","Abre Partilhar para convidares outras pessoas. Todos podem consultar e atualizar a mesma lista.":"Open Share to invite others. Everyone can view and update the same list.","Compras mais simples no supermercado":"Shopping made easier","Ativa o modo supermercado para te concentrares nos artigos por comprar. Também podes repetir compras, guardar listas habituais e guardar as faturas das compras para as consultar mais tarde.":"Turn on shopping mode to focus on items you still need. You can also repeat purchases and save regular lists.","Começar a usar a Listora":"Start using Listora","Continuar":"Continue","Saltar introdução":"Skip introduction","Fechar introdução":"Close introduction","Passo":"Step","Progresso da introdução":"Introduction progress","A tua compra":"Shopping list","Partilhar código":"Share code","CÓDIGO DA LISTA":"LIST CODE","A LISTA DA CASA":"THE HOUSEHOLD LIST","Partilhar":"Share","de":"of","comprados":"purchased","Menos esquecimentos, mais tempo juntos.":"Fewer forgotten items, more time together.","Não foi possível abrir a partilha. Copia o código em alternativa.":"Sharing couldn't be opened. Copy the code instead.","Copia este link e partilha com a família:":"Copy this link and share it with your family:","Copia este código e partilha com a família:":"Copy this code and share it with your family:","Queres remover todos os artigos já comprados?":"Remove all purchased items?","Compras concluídas removidas":"Purchased items removed","Lista não encontrada.":"List not found.","Não encontrámos essa lista. Confirma o código e tenta novamente.":"We couldn't find that list. Check the code and try again.",
"Lista de compras":"Shopping list","Faturas":"Receipts","Faturas de compras":"Shopping receipts","Comprovativos acessíveis a todos os membros desta lista.":"Receipts accessible to all members of this list.","Adicionar fatura":"Add receipt","Ex.: Ana":"E.g. Ana","O nome ficará associado às faturas que adicionares nesta lista.":"Your name will be associated with receipts you add to this list.","Guardar nome e continuar":"Save name and continue","Anexar fotografia ou PDF":"Attach photo or PDF","Mais artigos incluídos nas notas":"{count} more items included in the notes.","Abrir comprovativo":"Open receipt","Membro":"Member","Supermercado":"Supermarket","Data da compra":"Purchase date","Total (€)":"Total (€)","Notas (opcional)":"Notes (optional)","Máx. 10 MB":"Max. 10 MB","Sugerir dados com IA":"Suggest details with AI","Faturas partilhadas":"Shared receipts","Ainda não há faturas":"No receipts yet","Adiciona o primeiro comprovativo para ficar disponível a toda a família.":"Add the first receipt to make it available to the whole family.","Confirmar produtos":"Review products","Cancelar":"Cancel","Digitaliza com a câmara para entrar na lista":"Scan with your camera to join the list","O que está a faltar em casa?":"What are we running out of?","Escolhe como queres adicionar os produtos":"Choose how you want to add products","Fotografar lista":"Photograph list","Importa produtos de uma fotografia":"Import products from a photo","Adicionar por voz":"Add by voice","Dita os produtos sem escrever":"Dictate products without typing","Listas guardadas":"Saved lists","O teu nome":"Your name","A analisar fatura…":"Analyzing receipt…","Sugestões extraídas — confirma os campos acima":"Extracted suggestions — review the fields above","IVA identificado:":"VAT identified:","Copiar link de convite":"Copy invite link"
},
es: {"Tudo":"Todo","Fruta e legumes":"Fruta y verdura","Frescos":"Frescos","Despensa":"Despensa","Limpeza":"Limpieza","Outros":"Otros","A preparar a tua lista…":"Preparando tu lista…","MAIS SIMPLES, JUNTOS":"MÁS SENCILLO, JUNTOS","As compras da família.":"La compra familiar.","Sem esquecimentos.":"Sin olvidos.","Uma lista partilhada, sempre atualizada. Adiciona o que falta em casa e deixa o resto connosco.":"Una lista compartida y siempre actualizada. Añade lo que falta en casa.","Criar uma lista nova":"Crear una lista nueva","Começa uma lista e convida a família.":"Empieza una lista e invita a tu familia.","Nome da lista":"Nombre de la lista","Compras da família":"Compra familiar","Criar lista":"Crear lista","A criar…":"Creando…","ou":"o","Já tens um código de partilha?":"¿Ya tienes un código para compartir?","Entrar na lista":"Entrar en la lista","Partilhar":"Compartir","A LISTA DA CASA":"LA LISTA DE CASA","Sincronizada":"Sincronizada","A ligar…":"Conectando…","O que está a faltar em casa?":"¿Qué falta en casa?","Adicionar artigo":"Añadir producto","Qtd.":"Cant.","Categoria":"Categoría","Automática":"Automática","Já comprados":"Comprados","Falta comprar":"Por comprar","artigo":"producto","artigos":"productos","Ver por comprar":"Ver pendientes","A lista está vazia":"La lista está vacía","Nada nesta categoria":"Nada en esta categoría","Ainda não há compras concluídas":"Aún no hay compras completadas","Limpar artigos comprados":"Eliminar productos comprados","Sair da lista":"Salir de la lista","Fechar":"Cerrar","A lista é melhor em família":"La compra es mejor en familia","CÓDIGO DA LISTA":"CÓDIGO DE LA LISTA","Copiar link de convite":"Copiar enlace de invitación","Copiar apenas o código":"Copiar solo el código"},
fr: {"Tudo":"Tout","Fruta e legumes":"Fruits et légumes","Frescos":"Produits frais","Despensa":"Épicerie","Limpeza":"Nettoyage","Outros":"Autres","A preparar a tua lista…":"Préparation de votre liste…","MAIS SIMPLES, JUNTOS":"PLUS SIMPLE, ENSEMBLE","As compras da família.":"Les courses de la famille.","Sem esquecimentos.":"Sans rien oublier.","Criar uma lista nova":"Créer une nouvelle liste","Começa uma lista e convida a família.":"Créez une liste et invitez votre famille.","Nome da lista":"Nom de la liste","Criar lista":"Créer la liste","A criar…":"Création…","ou":"ou","Já tens um código de partilha?":"Vous avez déjà un code de partage ?","Entrar na lista":"Rejoindre la liste","Partilhar":"Partager","A LISTA DA CASA":"LA LISTE DE LA MAISON","Sincronizada":"Synchronisée","A ligar…":"Connexion…","O que está a faltar em casa?":"Que manque-t-il à la maison ?","Adicionar artigo":"Ajouter un article","Qtd.":"Qté","Categoria":"Catégorie","Automática":"Automatique","Já comprados":"Déjà achetés","Falta comprar":"À acheter","A lista está vazia":"Votre liste est vide","Limpar artigos comprados":"Effacer les articles achetés","Sair da lista":"Quitter la liste","Fechar":"Fermer","A lista é melhor em família":"Les courses, c’est mieux en famille","CÓDIGO DA LISTA":"CODE DE LA LISTE","Copiar link de convite":"Copier le lien d’invitation","Copiar apenas o código":"Copier uniquement le code"},
de: {"Uma lista partilhada, sempre atualizada. Adiciona o que falta em casa e deixa o resto connosco.":"Eine gemeinsame, stets aktuelle Liste. Ergänze, was zu Hause fehlt, und den Rest übernehmen wir.","Feita para partilhar. Simples para todos.":"Zum Teilen gemacht. Einfach für alle.","A tua casa, mais organizada.":"Ein besser organisiertes Zuhause.","Compras da família":"Familieneinkauf","Tudo":"Alle","Fruta e legumes":"Obst & Gemüse","Frescos":"Frischeprodukte","Despensa":"Vorrat","Limpeza":"Reinigung","Outros":"Sonstiges","A preparar a tua lista…":"Deine Liste wird vorbereitet…","MAIS SIMPLES, JUNTOS":"EINFACHER ZUSAMMEN","As compras da família.":"Familieneinkauf.","Sem esquecimentos.":"Nichts mehr vergessen.","Criar uma lista nova":"Neue Liste erstellen","Começa uma lista e convida a família.":"Erstelle eine Liste und lade deine Familie ein.","Nome da lista":"Listenname","Criar lista":"Liste erstellen","A criar…":"Wird erstellt…","ou":"oder","Já tens um código de partilha?":"Hast du schon einen Einladungscode?","Entrar na lista":"Liste öffnen","Partilhar":"Teilen","A LISTA DA CASA":"DIE HAUSHALTSLISTE","Sincronizada":"Synchronisiert","A ligar…":"Verbindung…","O que está a faltar em casa?":"Was fehlt zu Hause?","Adicionar artigo":"Artikel hinzufügen","Qtd.":"Menge","Categoria":"Kategorie","Automática":"Automatisch","Já comprados":"Bereits gekauft","Falta comprar":"Noch zu kaufen","A lista está vazia":"Deine Liste ist leer","Limpar artigos comprados":"Gekaufte Artikel löschen","Sair da lista":"Liste verlassen","Fechar":"Schließen","A lista é melhor em família":"Einkaufen ist gemeinsam besser","CÓDIGO DA LISTA":"LISTENCODE","Copiar link de convite":"Einladungslink kopieren","Copiar apenas o código":"Nur Code kopieren"},
it: {"Tudo":"Tutto","Fruta e legumes":"Frutta e verdura","Frescos":"Freschi","Despensa":"Dispensa","Limpeza":"Pulizia","Outros":"Altro","A preparar a tua lista…":"Preparazione della lista…","MAIS SIMPLES, JUNTOS":"PIÙ SEMPLICE, INSIEME","As compras da família.":"La spesa di famiglia.","Sem esquecimentos.":"Senza dimenticanze.","Criar uma lista nova":"Crea una nuova lista","Começa uma lista e convida a família.":"Crea una lista e invita la famiglia.","Nome da lista":"Nome della lista","Criar lista":"Crea lista","A criar…":"Creazione…","ou":"oppure","Já tens um código de partilha?":"Hai già un codice di condivisione?","Entrar na lista":"Entra nella lista","Partilhar":"Condividi","A LISTA DA CASA":"LA LISTA DI CASA","Sincronizada":"Sincronizzata","A ligar…":"Connessione…","O que está a faltar em casa?":"Cosa manca a casa?","Adicionar artigo":"Aggiungi articolo","Qtd.":"Qtà","Categoria":"Categoria","Automática":"Automatica","Já comprados":"Già acquistati","Falta comprar":"Da comprare","A lista está vazia":"La lista è vuota","Limpar artigos comprados":"Cancella articoli acquistati","Sair da lista":"Esci dalla lista","Fechar":"Chiudi","A lista é melhor em família":"La spesa è meglio in famiglia","CÓDIGO DA LISTA":"CODICE DELLA LISTA","Copiar link de convite":"Copia link d'invito","Copiar apenas o código":"Copia solo il codice"},
nl: {"Tudo":"Alles","Fruta e legumes":"Groente en fruit","Frescos":"Vers","Despensa":"Voorraadkast","Limpeza":"Schoonmaak","Outros":"Overig","A preparar a tua lista…":"Je lijst wordt klaargemaakt…","MAIS SIMPLES, JUNTOS":"EENVOUDIGER, SAMEN","As compras da família.":"Boodschappen voor het gezin.","Sem esquecimentos.":"Niets meer vergeten.","Criar uma lista nova":"Nieuwe lijst maken","Começa uma lista e convida a família.":"Maak een lijst en nodig je gezin uit.","Nome da lista":"Naam van de lijst","Criar lista":"Lijst maken","A criar…":"Bezig met maken…","ou":"of","Já tens um código de partilha?":"Heb je al een deelcode?","Entrar na lista":"Naar lijst","Partilhar":"Delen","A LISTA DA CASA":"DE HUISLIJST","Sincronizada":"Gesynchroniseerd","A ligar…":"Verbinden…","O que está a faltar em casa?":"Wat ontbreekt er thuis?","Adicionar artigo":"Artikel toevoegen","Qtd.":"Aantal","Categoria":"Categorie","Automática":"Automatisch","Já comprados":"Al gekocht","Falta comprar":"Nog kopen","A lista está vazia":"Je lijst is leeg","Limpar artigos comprados":"Gekochte artikelen wissen","Sair da lista":"Lijst verlaten","Fechar":"Sluiten","A lista é melhor em família":"Samen boodschappen doen is beter","CÓDIGO DA LISTA":"LIJSTCODE","Copiar link de convite":"Uitnodigingslink kopiëren","Copiar apenas o código":"Alleen code kopiëren"},
pl: {"Tudo":"Wszystko","Fruta e legumes":"Owoce i warzywa","Frescos":"Świeże","Despensa":"Spiżarnia","Limpeza":"Środki czystości","Outros":"Inne","A preparar a tua lista…":"Przygotowywanie listy…","MAIS SIMPLES, JUNTOS":"PROŚCIEJ RAZEM","As compras da família.":"Zakupy rodzinne.","Sem esquecimentos.":"Nic już nie umknie.","Criar uma lista nova":"Utwórz nową listę","Começa uma lista e convida a família.":"Utwórz listę i zaproś rodzinę.","Nome da lista":"Nazwa listy","Criar lista":"Utwórz listę","A criar…":"Tworzenie…","ou":"lub","Já tens um código de partilha?":"Masz już kod udostępniania?","Entrar na lista":"Dołącz do listy","Partilhar":"Udostępnij","A LISTA DA CASA":"LISTA DOMOWA","Sincronizada":"Zsynchronizowano","A ligar…":"Łączenie…","O que está a faltar em casa?":"Czego brakuje w domu?","Adicionar artigo":"Dodaj produkt","Qtd.":"Ilość","Categoria":"Kategoria","Automática":"Automatyczna","Já comprados":"Kupione","Falta comprar":"Do kupienia","A lista está vazia":"Lista jest pusta","Limpar artigos comprados":"Usuń kupione produkty","Sair da lista":"Opuść listę","Fechar":"Zamknij","A lista é melhor em família":"Zakupy lepsze razem","CÓDIGO DA LISTA":"KOD LISTY","Copiar link de convite":"Kopiuj link zaproszenia","Copiar apenas o código":"Kopiuj tylko kod"},
ro: {"Tudo":"Toate","Fruta e legumes":"Fructe și legume","Frescos":"Proaspete","Despensa":"Cămară","Limpeza":"Curățenie","Outros":"Altele","A preparar a tua lista…":"Se pregătește lista…","MAIS SIMPLES, JUNTOS":"MAI SIMPLU, ÎMPREUNĂ","As compras da família.":"Cumpărăturile familiei.","Sem esquecimentos.":"Fără să uiți nimic.","Criar uma lista nova":"Creează o listă nouă","Começa uma lista e convida a família.":"Începe o listă și invită familia.","Nome da lista":"Numele listei","Criar lista":"Creează lista","A criar…":"Se creează…","ou":"sau","Já tens um código de partilha?":"Ai deja un cod de partajare?","Entrar na lista":"Intră în listă","Partilhar":"Partajează","A LISTA DA CASA":"LISTA CASEI","Sincronizada":"Sincronizat","A ligar…":"Se conectează…","O que está a faltar em casa?":"Ce lipsește din casă?","Adicionar artigo":"Adaugă produs","Qtd.":"Cant.","Categoria":"Categorie","Automática":"Automată","Já comprados":"Cumpărate","Falta comprar":"De cumpărat","A lista está vazia":"Lista este goală","Limpar artigos comprados":"Șterge produsele cumpărate","Sair da lista":"Părăsește lista","Fechar":"Închide","A lista é melhor em família":"Cumpărăturile sunt mai ușoare în familie","CÓDIGO DA LISTA":"CODUL LISTEI","Copiar link de convite":"Copiază linkul de invitație","Copiar apenas o código":"Copiază doar codul"},
"zh-CN": {"Tudo":"全部","Fruta e legumes":"水果和蔬菜","Frescos":"生鲜","Despensa":"食品储藏","Limpeza":"清洁用品","Outros":"其他","A preparar a tua lista…":"正在准备清单…","MAIS SIMPLES, JUNTOS":"一起，更简单","As compras da família.":"家庭购物清单","Sem esquecimentos.":"不再遗漏","Criar uma lista nova":"创建新清单","Começa uma lista e convida a família.":"创建清单并邀请家人","Nome da lista":"清单名称","Criar lista":"创建清单","A criar…":"正在创建…","ou":"或","Já tens um código de partilha?":"已有共享码？","Entrar na lista":"加入清单","Partilhar":"分享","A LISTA DA CASA":"家庭清单","Sincronizada":"已同步","A ligar…":"正在连接…","O que está a faltar em casa?":"家里还缺什么？","Adicionar artigo":"添加商品","Qtd.":"数量","Categoria":"类别","Automática":"自动","Já comprados":"已购买","Falta comprar":"待购买","A lista está vazia":"清单为空","Limpar artigos comprados":"清除已购买商品","Sair da lista":"退出清单","Fechar":"关闭","A lista é melhor em família":"一起购物更轻松","CÓDIGO DA LISTA":"清单代码","Copiar link de convite":"复制邀请链接","Copiar apenas o código":"只复制代码"}
};
const EXTRA_I18N = {"en":{"Ver comprados":"View purchased","Limpar artigos comprados":"Clear purchased items","Sair da lista":"Leave list","Remover":"Remove","Ex.: A3K9PX":"e.g. A3K9PX","Guardar lista atual":"Save current list","Listas reutilizáveis":"Reusable lists","Repetir compras":"Buy again","Guarda uma compra habitual para a reutilizares noutra semana.":"Save a regular shopping list to reuse next week.","Modo supermercado":"Shopping mode","Ativo":"On","Ativar":"Start","A tua compra":"Shopping list","Ver por comprar":"View items to buy","Sair desta lista neste dispositivo? A lista partilhada não será apagada.":"Leave this list on this device? The shared list will not be deleted.","Artigo adicionado novamente":"Item added again","Lista guardada neste dispositivo":"List saved on this device","Lista reutilizada":"List restored","Queres remover todos os artigos já comprados?":"Remove all purchased items?","Compras concluídas removidas":"Purchased items removed","Copia este código e partilha com a família:":"Copy this code and share it with your family:","Lista não encontrada.":"List not found.","Não encontrámos essa lista. Confirma o código e tenta novamente.":"We couldn't find that list. Check the code and try again.","Código da lista copiado!":"List code copied!","Falta configurar o Supabase":"Supabase setup required","Cria um projeto Supabase, executa o SQL de":"Create a Supabase project, run the SQL in","e define":"and set","no ficheiro":"in the file","e":"and","Criar a minha lista":"Create my list","Fechar aviso de instalação":"Dismiss installation notice","Sempre à mão":"Always at hand","Notificações":"Notifications","Bacon":"Bacon","Bananas":"Bananas","Pizza":"Pizza","Ações rápidas":"Quick actions","Para instalar a Listora, abre primeiro este endereço no Safari.":"To install Listora, first open this address in Safari.","A instalação é feita pelo menu Partilhar do Safari. Demora apenas alguns segundos.":"Installation is done from Safari’s Share menu and takes only a few seconds.","No Chrome para computador, abre o menu ⋮ e procura a opção Instalar Listora. Se não aparecer, o Chrome pode ainda não considerar o site elegível para instalação.":"In desktop Chrome, open the ⋮ menu and look for Install Listora. If it is missing, Chrome may not yet consider the site eligible for installation.","1. Toca em Partilhar":"1. Tap Share","Na barra do Safari, em baixo ou no topo.":"In the Safari toolbar, at the bottom or top.","2. Adicionar ao ecrã principal":"2. Add to Home Screen","Se não aparecer, procura em Editar ações.":"If it does not appear, look under Edit Actions.","3. Confirma em Adicionar":"3. Confirm by tapping Add","O ícone da Listora ficará no ecrã inicial.":"The Listora icon will appear on your home screen.","Mostra este QR Code a quem queres convidar. Ao digitalizar, o convite abre a Listora com esta lista pronta a entrar.":"Show this QR code to the person you want to invite. Scanning it opens Listora with this list ready to join.","Instalar Listora":"Install Listora","Instala a Listora":"Install Listora","Acede às tuas listas diretamente no telemóvel, com mais rapidez e funcionalidades.":"Access your lists directly on your phone, with more speed and features.","Como instalar":"How to install","Mais rápido":"Faster"},"es":{"Uma lista partilhada, sempre atualizada. Adiciona o que falta em casa e deixa o resto connosco.":"Una lista compartida que siempre está al día. Añade lo que falta en casa y deja el resto en nuestras manos.","Feita para partilhar. Simples para todos.":"Hecha para compartir. Fácil para todos.","A tua casa, mais organizada.":"Tu casa, más organizada.","Guardar lista atual":"Guardar la lista actual","Listas reutilizáveis":"Listas reutilizables","Repetir compras":"Volver a comprar","Guarda uma compra habitual para a reutilizares noutra semana.":"Guarda una compra habitual para reutilizarla otra semana.","Modo supermercado":"Modo supermercado","Ativo":"Activo","Ativar":"Activar","A tua compra":"Tu compra","Ver por comprar":"Ver pendientes","Ver comprados":"Ver comprados","Limpar artigos comprados":"Borrar productos comprados","Menos esquecimentos, mais tempo juntos.":"Menos olvidos, más tiempo juntos.","Sair da lista":"Salir de la lista","Sair desta lista neste dispositivo? A lista partilhada não será apagada.":"¿Salir de esta lista en este dispositivo? La lista compartida no se eliminará.","Artigo adicionado novamente":"Producto añadido de nuevo","Lista guardada neste dispositivo":"Lista guardada en este dispositivo","Lista reutilizada":"Lista reutilizada","Queres remover todos os artigos já comprados?":"¿Quieres eliminar todos los productos comprados?","Compras concluídas removidas":"Productos comprados eliminados","Copia este código e partilha com a família:":"Copia este código y compártelo con tu familia:","Lista não encontrada.":"Lista no encontrada.","Não encontrámos essa lista. Confirma o código e tenta novamente.":"No encontramos esa lista. Comprueba el código e inténtalo de nuevo.","Código da lista copiado!":"¡Código de la lista copiado!","Qualquer pessoa com o código pode aceder à lista. Partilha apenas com pessoas de confiança.":"Cualquiera que tenga el código puede acceder a esta lista. Compártelo solo con personas de confianza.","Partilha o código com a família. Cada pessoa introduz o código na app para abrir a mesma lista e sincronizar as alterações.":"Comparte el código con tu familia. Cada persona lo introduce en la app para abrir la misma lista y sincronizar los cambios."},"fr":{"Uma lista partilhada, sempre atualizada. Adiciona o que falta em casa e deixa o resto connosco.":"Une liste partagée toujours à jour. Ajoutez ce qui manque à la maison et laissez-nous faire le reste.","Feita para partilhar. Simples para todos.":"Conçue pour le partage. Simple pour tout le monde.","A tua casa, mais organizada.":"Une maison mieux organisée.","Guardar lista atual":"Enregistrer la liste actuelle","Listas reutilizáveis":"Listes réutilisables","Repetir compras":"Racheter","Guarda uma compra habitual para a reutilizares noutra semana.":"Enregistrez une liste habituelle pour la réutiliser une autre semaine.","Modo supermercado":"Mode courses","Ativo":"Activé","Ativar":"Activer","A tua compra":"Vos courses","Ver por comprar":"Voir les articles à acheter","Ver comprados":"Voir les articles achetés","Limpar artigos comprados":"Effacer les articles achetés","Menos esquecimentos, mais tempo juntos.":"Moins d’oublis, plus de temps ensemble.","Sair da lista":"Quitter la liste","Sair desta lista neste dispositivo? A lista partilhada não será apagada.":"Quitter cette liste sur cet appareil ? La liste partagée ne sera pas supprimée.","Artigo adicionado novamente":"Article ajouté à nouveau","Lista guardada neste dispositivo":"Liste enregistrée sur cet appareil","Lista reutilizada":"Liste réutilisée","Queres remover todos os artigos já comprados?":"Voulez-vous supprimer tous les articles achetés ?","Compras concluídas removidas":"Articles achetés supprimés","Copia este código e partilha com a família:":"Copiez ce code et partagez-le avec votre famille:","Lista não encontrada.":"Liste introuvable.","Não encontrámos essa lista. Confirma o código e tenta novamente.":"Liste introuvable. Vérifiez le code et réessayez.","Código da lista copiado!":"Code de la liste copié !","Qualquer pessoa com o código pode aceder à lista. Partilha apenas com pessoas de confiança.":"Toute personne disposant du code peut accéder à cette liste. Partagez-le uniquement avec des personnes de confiance.","Partilha o código com a família. Cada pessoa introduz o código na app para abrir a mesma lista e sincronizar as alterações.":"Partagez le code avec votre famille. Chacun le saisit dans l’application pour ouvrir la même liste et synchroniser les modifications."},"de":{"Guardar lista atual":"Aktuelle Liste speichern","Listas reutilizáveis":"Wiederverwendbare Listen","Repetir compras":"Erneut kaufen","Guarda uma compra habitual para a reutilizares noutra semana.":"Speichere einen regelmäßigen Einkauf, um ihn nächste Woche wiederzuverwenden.","Modo supermercado":"Einkaufsmodus","Ativo":"Aktiv","Ativar":"Aktivieren","A tua compra":"Dein Einkauf","Ver por comprar":"Noch zu kaufen anzeigen","Ver comprados":"Gekaufte anzeigen","Limpar artigos comprados":"Gekaufte Artikel löschen","Menos esquecimentos, mais tempo juntos.":"Weniger vergessen, mehr Zeit miteinander.","Sair da lista":"Liste verlassen","Sair desta lista neste dispositivo? A lista partilhada não será apagada.":"Diese Liste auf diesem Gerät verlassen? Die geteilte Liste wird nicht gelöscht.","Artigo adicionado novamente":"Artikel erneut hinzugefügt","Lista guardada neste dispositivo":"Liste auf diesem Gerät gespeichert","Lista reutilizada":"Liste wiederverwendet","Queres remover todos os artigos já comprados?":"Möchtest du alle gekauften Artikel entfernen?","Compras concluídas removidas":"Gekaufte Artikel entfernt","Copia este código e partilha com a família:":"Kopiere diesen Code und teile ihn mit deiner Familie:","Lista não encontrada.":"Liste nicht gefunden.","Não encontrámos essa lista. Confirma o código e tenta novamente.":"Liste nicht gefunden. Prüfe den Code und versuche es erneut.","Código da lista copiado!":"Listencode kopiert!","Qualquer pessoa com o código pode aceder à lista. Partilha apenas com pessoas de confiança.":"Jede Person mit dem Code kann auf diese Liste zugreifen. Teile ihn nur mit vertrauenswürdigen Personen.","Partilha o código com a família. Cada pessoa introduz o código na app para abrir a mesma lista e sincronizar as alterações.":"Teile den Code mit deiner Familie. Alle geben ihn in der App ein, um dieselbe Liste zu öffnen und Änderungen zu synchronisieren."},"it":{"Guardar lista atual":"Salva la lista attuale","Listas reutilizáveis":"Liste riutilizzabili","Repetir compras":"Riacquista","Guarda uma compra habitual para a reutilizares noutra semana.":"Salva una lista della spesa abituale per riutilizzarla la settimana successiva.","Modo supermercado":"Modalità spesa","Ativo":"Attiva","Ativar":"Attiva","A tua compra":"La tua spesa","Ver por comprar":"Vedi da comprare","Ver comprados":"Vedi acquistati","Limpar artigos comprados":"Elimina gli articoli acquistati","Menos esquecimentos, mais tempo juntos.":"Meno dimenticanze, più tempo insieme.","Sair da lista":"Esci dalla lista","Sair desta lista neste dispositivo? A lista partilhada não será apagada.":"Uscire da questa lista su questo dispositivo? La lista condivisa non verrà eliminata.","Artigo adicionado novamente":"Articolo aggiunto di nuovo","Lista guardada neste dispositivo":"Lista salvata su questo dispositivo","Lista reutilizada":"Lista riutilizzata","Queres remover todos os artigos já comprados?":"Vuoi rimuovere tutti gli articoli acquistati?","Compras concluídas removidas":"Articoli acquistati rimossi","Copia este código e partilha com a família:":"Copia questo codice e condividilo con la famiglia:","Lista não encontrada.":"Lista non trovata.","Não encontrámos essa lista. Confirma o código e tenta novamente.":"Lista non trovata. Controlla il codice e riprova.","Código da lista copiado!":"Codice della lista copiato!","Qualquer pessoa com o código pode aceder à lista. Partilha apenas com pessoas de confiança.":"Chiunque abbia il codice può accedere a questa lista. Condividilo solo con persone fidate.","Partilha o código com a família. Cada pessoa introduz o código na app para abrir a mesma lista e sincronizar as alterações.":"Condividi il codice con la famiglia. Ogni persona lo inserisce nell'app per aprire la stessa lista e sincronizzare le modifiche."},"nl":{"Guardar lista atual":"Huidige lijst opslaan","Listas reutilizáveis":"Herbruikbare lijsten","Repetir compras":"Opnieuw kopen","Guarda uma compra habitual para a reutilizares noutra semana.":"Bewaar een vaste boodschappenlijst om die volgende week opnieuw te gebruiken.","Modo supermercado":"Boodschappenmodus","Ativo":"Actief","Ativar":"Activeren","A tua compra":"Jouw boodschappen","Ver por comprar":"Nog te kopen bekijken","Ver comprados":"Gekochte bekijken","Limpar artigos comprados":"Gekochte artikelen wissen","Menos esquecimentos, mais tempo juntos.":"Minder vergeten, meer tijd samen.","Sair da lista":"Lijst verlaten","Sair desta lista neste dispositivo? A lista partilhada não será apagada.":"Deze lijst op dit apparaat verlaten? De gedeelde lijst wordt niet verwijderd.","Artigo adicionado novamente":"Artikel opnieuw toegevoegd","Lista guardada neste dispositivo":"Lijst opgeslagen op dit apparaat","Lista reutilizada":"Lijst opnieuw gebruikt","Queres remover todos os artigos já comprados?":"Wil je alle gekochte artikelen verwijderen?","Compras concluídas removidas":"Gekochte artikelen verwijderd","Copia este código e partilha com a família:":"Kopieer deze code en deel hem met je gezin:","Lista não encontrada.":"Lijst niet gevonden.","Não encontrámos essa lista. Confirma o código e tenta novamente.":"We konden de lijst niet vinden. Controleer de code en probeer opnieuw.","Código da lista copiado!":"Lijstcode gekopieerd!","Qualquer pessoa com o código pode aceder à lista. Partilha apenas com pessoas de confiança.":"Iedereen met de code heeft toegang tot deze lijst. Deel de code alleen met mensen die je vertrouwt.","Partilha o código com a família. Cada pessoa introduz o código na app para abrir a mesma lista e sincronizar as alterações.":"Deel de code met je gezin. Iedereen voert de code in de app in om dezelfde lijst te openen en wijzigingen te synchroniseren."},"pl":{"Guardar lista atual":"Zapisz bieżącą listę","Listas reutilizáveis":"Listy wielokrotnego użytku","Repetir compras":"Kup ponownie","Guarda uma compra habitual para a reutilizares noutra semana.":"Zapisz typową listę zakupów, aby użyć jej ponownie w kolejnym tygodniu.","Modo supermercado":"Tryb zakupów","Ativo":"Włączony","Ativar":"Włącz","A tua compra":"Twoje zakupy","Ver por comprar":"Pokaż do kupienia","Ver comprados":"Pokaż kupione","Limpar artigos comprados":"Usuń kupione produkty","Menos esquecimentos, mais tempo juntos.":"Mniej zapominania, więcej wspólnego czasu.","Sair da lista":"Opuść listę","Sair desta lista neste dispositivo? A lista partilhada não será apagada.":"Opuścić tę listę na tym urządzeniu? Lista udostępniona nie zostanie usunięta.","Artigo adicionado novamente":"Produkt dodany ponownie","Lista guardada neste dispositivo":"Lista zapisana na tym urządzeniu","Lista reutilizada":"Lista użyta ponownie","Queres remover todos os artigos já comprados?":"Czy usunąć wszystkie kupione produkty?","Compras concluídas removidas":"Usunięto kupione produkty","Copia este código e partilha com a família:":"Skopiuj ten kod i udostępnij go rodzinie:","Lista não encontrada.":"Nie znaleziono listy.","Não encontrámos essa lista. Confirma o código e tenta novamente.":"Nie znaleziono listy. Sprawdź kod i spróbuj ponownie.","Código da lista copiado!":"Skopiowano kod listy!","Qualquer pessoa com o código pode aceder à lista. Partilha apenas com pessoas de confiança.":"Każda osoba z kodem może uzyskać dostęp do listy. Udostępniaj go tylko zaufanym osobom.","Partilha o código com a família. Cada pessoa introduz o código na app para abrir a mesma lista e sincronizar as alterações.":"Udostępnij kod rodzinie. Każda osoba wpisuje go w aplikacji, aby otworzyć tę samą listę i synchronizować zmiany."},"ro":{"Guardar lista atual":"Salvează lista curentă","Listas reutilizáveis":"Liste reutilizabile","Repetir compras":"Cumpără din nou","Guarda uma compra habitual para a reutilizares noutra semana.":"Salvează o listă obișnuită de cumpărături pentru a o reutiliza săptămâna viitoare.","Modo supermercado":"Mod cumpărături","Ativo":"Activ","Ativar":"Activează","A tua compra":"Cumpărăturile tale","Ver por comprar":"Vezi de cumpărat","Ver comprados":"Vezi cumpărate","Limpar artigos comprados":"Șterge produsele cumpărate","Menos esquecimentos, mais tempo juntos.":"Mai puține lucruri uitate, mai mult timp împreună.","Sair da lista":"Ieși din listă","Sair desta lista neste dispositivo? A lista partilhada não será apagada.":"Ieși din această listă de pe dispozitiv? Lista partajată nu va fi ștearsă.","Artigo adicionado novamente":"Produs adăugat din nou","Lista guardada neste dispositivo":"Listă salvată pe acest dispozitiv","Lista reutilizada":"Listă reutilizată","Queres remover todos os artigos já comprados?":"Vrei să elimini toate produsele cumpărate?","Compras concluídas removidas":"Produse cumpărate eliminate","Copia este código e partilha com a família:":"Copiază acest cod și distribuie-l familiei:","Lista não encontrada.":"Lista nu a fost găsită.","Não encontrámos essa lista. Confirma o código e tenta novamente.":"Nu am găsit lista. Verifică codul și încearcă din nou.","Código da lista copiado!":"Codul listei a fost copiat!","Qualquer pessoa com o código pode aceder à lista. Partilha apenas com pessoas de confiança.":"Oricine are codul poate accesa lista. Distribuie-l doar persoanelor de încredere.","Partilha o código com a família. Cada pessoa introduz o código na app para abrir a mesma lista e sincronizar as alterações.":"Distribuie codul familiei. Fiecare persoană îl introduce în aplicație pentru a deschide aceeași listă și a sincroniza modificările."},"zh-CN":{"Guardar lista atual":"保存当前清单","Listas reutilizáveis":"可重复使用的清单","Repetir compras":"再次购买","Guarda uma compra habitual para a reutilizares noutra semana.":"保存常用购物清单，下周可再次使用。","Modo supermercado":"购物模式","Ativo":"已开启","Ativar":"开启","A tua compra":"你的购物清单","Ver por comprar":"查看待购买","Ver comprados":"查看已购买","Limpar artigos comprados":"清除已购买商品","Menos esquecimentos, mais tempo juntos.":"少些遗忘，多些相伴。","Sair da lista":"退出清单","Sair desta lista neste dispositivo? A lista partilhada não será apagada.":"要在此设备上退出此清单吗？共享清单不会被删除。","Artigo adicionado novamente":"已重新添加商品","Lista guardada neste dispositivo":"清单已保存在此设备","Lista reutilizada":"已重新使用清单","Queres remover todos os artigos já comprados?":"要删除所有已购买商品吗？","Compras concluídas removidas":"已删除已购买商品","Copia este código e partilha com a família:":"复制此代码并与家人分享：","Lista não encontrada.":"未找到清单。","Não encontrámos essa lista. Confirma o código e tenta novamente.":"未找到该清单。请检查代码并重试。","Código da lista copiado!":"清单代码已复制！","Qualquer pessoa com o código pode aceder à lista. Partilha apenas com pessoas de confiança.":"任何拥有代码的人都可以访问此清单。请仅与可信的人分享。","Partilha o código com a família. Cada pessoa introduz o código na app para abrir a mesma lista e sincronizar as alterações.":"与家人分享代码。每个人在应用中输入代码即可打开同一清单并同步更改。"}};
const AUDIT_I18N = {
  es: {
    "Instalar ahora":"Instalar ahora","Instalar Listora":"Instalar Listora","Como instalar":"Cómo instalar","Mais rápido":"Más rápido","Acede às tuas listas diretamente no telemóvel, com mais rapidez e funcionalidades.":"Accede a tus listas directamente desde el móvil, con más rapidez y funciones.","Lista otimizada para comprar na loja":"Lista optimizada para comprar en la tienda","Partilhar com família e amigos":"Compartir con familiares y amigos","Modo supermercado":"Modo supermercado","Ativar":"Activar","Ativo":"Activo","Descobrir":"Descubrir","Voltar à página inicial":"Volver al inicio","Instala a Listora":"Instala Listora","Adicionar ao ecrã principal":"Añadir a la pantalla de inicio","Sair da lista":"Salir de la lista","Guardar fatura":"Guardar recibo","Adicionar fatura":"Añadir recibo","Faturas de compras":"Recibos de compra","Lista de compras":"Lista de la compra","Cancelar":"Cancelar","Continuar":"Continuar","Fechar":"Cerrar","Partilhar":"Compartir","Criar lista":"Crear lista","Entrar na lista":"Entrar en la lista"
  },
  fr: {
    "Instalar agora":"Installer maintenant","Instalar Listora":"Installer Listora","Como instalar":"Comment installer","Mais rápido":"Plus rapide","Acede às tuas listas diretamente no telemóvel, com mais rapidez e funcionalidades.":"Accédez à vos listes directement sur votre téléphone, plus rapidement et avec davantage de fonctionnalités.","Lista otimizada para comprar na loja":"Liste optimisée pour faire les courses en magasin","Partilhar com família e amigos":"Partager avec la famille et les amis","Modo supermercado":"Mode supermarché","Ativar":"Activer","Ativo":"Activé","Descobrir":"Découvrir","Voltar à página inicial":"Retour à l’accueil","Instala a Listora":"Installer Listora","Adicionar ao ecrã principal":"Ajouter à l’écran d’accueil","Sair da lista":"Quitter la liste","Guardar fatura":"Enregistrer le reçu","Adicionar fatura":"Ajouter un reçu","Faturas de compras":"Reçus de courses","Lista de compras":"Liste de courses","Cancelar":"Annuler","Continuar":"Continuer","Fechar":"Fermer","Partilhar":"Partager","Criar lista":"Créer une liste","Entrar na lista":"Rejoindre la liste"
  },
  de: {
    "Instalar agora":"Jetzt installieren","Instalar Listora":"Listora installieren","Como instalar":"Installationsanleitung","Mais rápido":"Schneller","Acede às tuas listas diretamente no telemóvel, com mais rapidez e funcionalidades.":"Greife direkt auf deinem Smartphone schneller und mit mehr Funktionen auf deine Listen zu.","Lista otimizada para comprar na loja":"Optimierte Liste für den Einkauf im Geschäft","Partilhar com família e amigos":"Mit Familie und Freunden teilen","Modo supermercado":"Einkaufsmodus","Ativar":"Aktivieren","Ativo":"Aktiv","Descobrir":"Entdecken","Voltar à página inicial":"Zurück zur Startseite","Instala a Listora":"Listora installieren","Adicionar ao ecrã principal":"Zum Startbildschirm hinzufügen","Sair da lista":"Liste verlassen","Guardar fatura":"Beleg speichern","Adicionar fatura":"Beleg hinzufügen","Faturas de compras":"Einkaufsbelege","Lista de compras":"Einkaufsliste","Cancelar":"Abbrechen","Continuar":"Weiter","Fechar":"Schließen","Partilhar":"Teilen","Criar lista":"Liste erstellen","Entrar na lista":"Liste öffnen"
  },
  it: {
    "Instalar agora":"Installa ora","Instalar Listora":"Installa Listora","Como instalar":"Come installare","Mais rápido":"Più veloce","Acede às tuas listas diretamente no telemóvel, com mais rapidez e funcionalidades.":"Accedi alle tue liste direttamente dal telefono, più velocemente e con più funzionalità.","Lista otimizada para comprar na loja":"Lista ottimizzata per fare la spesa in negozio","Partilhar com família e amigos":"Condividi con familiari e amici","Modo supermercado":"Modalità supermercato","Ativar":"Attiva","Ativo":"Attiva","Descobrir":"Scopri","Voltar à página inicial":"Torna alla pagina iniziale","Instala a Listora":"Installa Listora","Adicionar ao ecrã principal":"Aggiungi alla schermata Home","Sair da lista":"Esci dalla lista","Guardar fatura":"Salva lo scontrino","Adicionar fatura":"Aggiungi scontrino","Faturas de compras":"Scontrini della spesa","Lista de compras":"Lista della spesa","Cancelar":"Annulla","Continuar":"Continua","Fechar":"Chiudi","Partilhar":"Condividi","Criar lista":"Crea lista","Entrar na lista":"Entra nella lista"
  },
  nl: {
    "Instalar agora":"Nu installeren","Instalar Listora":"Listora installeren","Como instalar":"Installeren","Mais rápido":"Sneller","Acede às tuas listas diretamente no telemóvel, com mais rapidez e funcionalidades.":"Open je lijsten sneller en met meer functies rechtstreeks op je telefoon.","Lista otimizada para comprar na loja":"Geoptimaliseerde lijst voor boodschappen in de winkel","Partilhar com família e amigos":"Delen met familie en vrienden","Modo supermercado":"Winkelmodus","Ativar":"Activeren","Ativo":"Actief","Descobrir":"Ontdekken","Voltar à página inicial":"Terug naar startpagina","Instala a Listora":"Listora installeren","Adicionar ao ecrã principal":"Toevoegen aan beginscherm","Sair da lista":"Lijst verlaten","Guardar fatura":"Bon bewaren","Adicionar fatura":"Bon toevoegen","Faturas de compras":"Boodschappenbonnen","Lista de compras":"Boodschappenlijst","Cancelar":"Annuleren","Continuar":"Doorgaan","Fechar":"Sluiten","Partilhar":"Delen","Criar lista":"Lijst maken","Entrar na lista":"Naar de lijst"
  },
  pl: {
    "Instalar agora":"Zainstaluj teraz","Instalar Listora":"Zainstaluj Listora","Como instalar":"Jak zainstalować","Mais rápido":"Szybciej","Acede às tuas listas diretamente no telemóvel, com mais rapidez e funcionalidades.":"Uzyskaj szybszy dostęp do list bezpośrednio w telefonie i korzystaj z dodatkowych funkcji.","Lista otimizada para comprar na loja":"Lista zoptymalizowana pod zakupy w sklepie","Partilhar com família e amigos":"Udostępnij rodzinie i znajomym","Modo supermercado":"Tryb zakupów","Ativar":"Włącz","Ativo":"Włączony","Descobrir":"Odkryj","Voltar à página inicial":"Wróć na stronę główną","Instala a Listora":"Zainstaluj Listora","Adicionar ao ecrã principal":"Dodaj do ekranu głównego","Sair da lista":"Opuść listę","Guardar fatura":"Zapisz paragon","Adicionar fatura":"Dodaj paragon","Faturas de compras":"Paragony zakupowe","Lista de compras":"Lista zakupów","Cancelar":"Anuluj","Continuar":"Kontynuuj","Fechar":"Zamknij","Partilhar":"Udostępnij","Criar lista":"Utwórz listę","Entrar na lista":"Dołącz do listy"
  },
  ro: {
    "Instalar agora":"Instalează acum","Instalar Listora":"Instalează Listora","Como instalar":"Cum se instalează","Mais rápido":"Mai rapid","Acede às tuas listas diretamente no telemóvel, com mais rapidez e funcionalidades.":"Accesează listele direct de pe telefon, mai rapid și cu mai multe funcții.","Lista otimizada para comprar na loja":"Listă optimizată pentru cumpărături în magazin","Partilhar com família e amigos":"Partajează cu familia și prietenii","Modo supermercado":"Mod supermarket","Ativar":"Activează","Ativo":"Activ","Descobrir":"Descoperă","Voltar à página inicial":"Înapoi la pagina principală","Instala a Listora":"Instalează Listora","Adicionar ao ecrã principal":"Adaugă pe ecranul principal","Sair da lista":"Părăsește lista","Guardar fatura":"Salvează bonul","Adicionar fatura":"Adaugă bon","Faturas de compras":"Bonuri de cumpărături","Lista de compras":"Listă de cumpărături","Cancelar":"Anulează","Continuar":"Continuă","Fechar":"Închide","Partilhar":"Partajează","Criar lista":"Creează lista","Entrar na lista":"Intră în listă"
  },
  "zh-CN": {
    "Instalar agora":"立即安装","Instalar Listora":"安装 Listora","Como instalar":"安装方法","Mais rápido":"更快捷","Acede às tuas listas diretamente no telemóvel, com mais rapidez e funcionalidades.":"在手机上直接访问清单，使用更快捷、功能更丰富。","Lista otimizada para comprar na loja":"为超市购物优化的清单","Partilhar com família e amigos":"与家人和朋友分享","Modo supermercado":"购物模式","Ativar":"启用","Ativo":"已启用","Descobrir":"发现","Voltar à página inicial":"返回首页","Instala a Listora":"安装 Listora","Adicionar ao ecrã principal":"添加到主屏幕","Sair da lista":"退出清单","Guardar fatura":"保存收据","Adicionar fatura":"添加收据","Faturas de compras":"购物收据","Lista de compras":"购物清单","Cancelar":"取消","Continuar":"继续","Fechar":"关闭","Partilhar":"分享","Criar lista":"创建清单","Entrar na lista":"加入清单"
  }
};
const RECEIPTS_TABS_I18N = {
  en: {
    "Secções da lista":"List sections","Apagar fatura":"Delete receipt","Filtrar por categoria":"Filter by category","Idioma":"Language","Método não permitido.":"Method not allowed.","O serviço de IA ainda não está configurado no Supabase. Define o segredo GEMINI_API_KEY.":"The AI service is not configured in Supabase yet. Set the GEMINI_API_KEY secret.","Formato não suportado. Usa JPG, PNG, WebP ou PDF.":"Unsupported format. Use JPG, PNG, WebP or PDF.","O ficheiro está vazio ou excede o limite de 10 MB.":"The file is empty or exceeds the 10 MB limit.","O serviço de IA atingiu o limite de pedidos. Tenta novamente mais tarde.":"The AI service has reached its request limit. Try again later.","Não foi possível analisar a fatura. Confirma a configuração do serviço de IA e tenta novamente.":"The receipt could not be analysed. Check the AI service configuration and try again.","O ficheiro não pôde ser analisado. Tenta usar uma imagem mais nítida ou um PDF legível.":"The file could not be analysed. Try a clearer image or a readable PDF.","Seleciona primeiro uma fotografia ou PDF da fatura.":"Select a receipt photo or PDF first.","Usa uma imagem JPG, PNG, WebP ou PDF.":"Use a JPG, PNG, WebP or PDF image.","O comprovativo deve ter no máximo 10 MB.":"The receipt must be no larger than 10 MB.","Não foi possível ler o ficheiro.":"The file could not be read.","Não foi possível analisar a fatura.":"The receipt could not be analysed.","A IA não conseguiu analisar esta fatura.":"AI could not analyse this receipt.","Mais artigos incluídos nas notas":"{count} more items included in the notes."
  },
  es: {
    "Secções da lista":"Secciones de la lista","Apagar fatura":"Eliminar recibo","Filtrar por categoria":"Filtrar por categoría","Idioma":"Idioma","Método não permitido.":"Método no permitido.","O serviço de IA ainda não está configurado no Supabase. Define o segredo GEMINI_API_KEY.":"El servicio de IA aún no está configurado en Supabase. Define el secreto GEMINI_API_KEY.","Formato não suportado. Usa JPG, PNG, WebP ou PDF.":"Formato no compatible. Usa JPG, PNG, WebP o PDF.","O ficheiro está vazio ou excede o limite de 10 MB.":"El archivo está vacío o supera el límite de 10 MB.","O serviço de IA atingiu o limite de pedidos. Tenta novamente mais tarde.":"El servicio de IA ha alcanzado el límite de solicitudes. Inténtalo más tarde.","Não foi possível analisar a fatura. Confirma a configuração do serviço de IA e tenta novamente.":"No se pudo analizar el recibo. Comprueba la configuración del servicio de IA e inténtalo de nuevo.","O ficheiro não pôde ser analisado. Tenta usar uma imagem mais nítida ou um PDF legível.":"No se pudo analizar el archivo. Prueba con una imagen más nítida o un PDF legible.","Seleciona primeiro uma fotografia ou PDF da fatura.":"Selecciona primero una foto o un PDF del recibo.","Usa uma imagem JPG, PNG, WebP ou PDF.":"Usa una imagen JPG, PNG, WebP o PDF.","O comprovativo deve ter no máximo 10 MB.":"El comprobante no debe superar los 10 MB.","Não foi possível ler o ficheiro.":"No se pudo leer el archivo.","Não foi possível analisar a fatura.":"No se pudo analizar el recibo.","A IA não conseguiu analisar esta fatura.":"La IA no pudo analizar este recibo.","Mais artigos incluídos nas notas":"{count} artículos más incluidos en las notas.",
    "Lista de compras":"Lista de la compra","Faturas":"Recibos","Faturas de compras":"Recibos de compra","Comprovativos acessíveis a todos os membros desta lista.":"Comprobantes accesibles para todos los miembros de esta lista.","Adicionar fatura":"Añadir recibo","Antes de guardar, como te devemos identificar?":"Antes de guardar, ¿cómo debemos identificarte?","O teu nome":"Tu nombre","Ex.: Ana":"Ej.: Ana","O nome ficará associado às faturas que adicionares nesta lista.":"Tu nombre se asociará a los recibos que añadas a esta lista.","Guardar nome e continuar":"Guardar nombre y continuar","Supermercado":"Supermercado","Data da compra":"Fecha de compra","Total (€)":"Total (€)","Notas (opcional)":"Notas (opcional)","Ex.: compras da semana, IVA, descontos…":"Ej.: compra semanal, IVA, descuentos…","Tirar fotografia ou anexar ficheiro":"Hacer una foto o adjuntar un archivo","Ficheiro selecionado":"Archivo seleccionado","Fotografia ou PDF · até 10 MB":"Foto o PDF · hasta 10 MB","Carregar ficheiro":"Subir archivo","A analisar…":"Analizando…","A analisar a fatura com IA…":"Analizando el recibo con IA…","A identificar o supermercado, a data, o total, o IVA e os artigos. Isto pode demorar alguns segundos.":"Identificando la tienda, la fecha, el total, el IVA y los artículos. Puede tardar unos segundos.","Não feches esta página. Vamos preencher os campos automaticamente para confirmares antes de guardar.":"No cierres esta página. Rellenaremos los campos automáticamente para que los revises antes de guardar.","A IA tenta identificar o supermercado, a data, o total, o IVA e os artigos. Revê sempre as sugestões antes de guardar.":"La IA intentará identificar la tienda, la fecha, el total, el IVA y los artículos. Revisa siempre las sugerencias antes de guardar.","Sugestões extraídas — confirma os campos acima":"Sugerencias extraídas: revisa los campos anteriores","IVA identificado":"IVA identificado","Artigos identificados":"Artículos identificados","Guardar fatura":"Guardar recibo","Faturas partilhadas":"Recibos compartidos","fatura":"recibo","faturas":"recibos","Ainda não há faturas":"Todavía no hay recibos","Adiciona o primeiro comprovativo para ficar disponível a toda a família.":"Añade el primer comprobante para que esté disponible para toda la familia.","Membro":"Miembro","Abrir comprovativo":"Abrir comprobante"
  },
  fr: {
    "Secções da lista":"Sections de la liste","Apagar fatura":"Supprimer le reçu","Filtrar por categoria":"Filtrer par catégorie","Idioma":"Langue","Método não permitido.":"Méthode non autorisée.","O serviço de IA ainda não está configurado no Supabase. Define o segredo GEMINI_API_KEY.":"Le service d’IA n’est pas encore configuré dans Supabase. Définissez le secret GEMINI_API_KEY.","Formato não suportado. Usa JPG, PNG, WebP ou PDF.":"Format non pris en charge. Utilisez JPG, PNG, WebP ou PDF.","O ficheiro está vazio ou excede o limite de 10 MB.":"Le fichier est vide ou dépasse la limite de 10 Mo.","O serviço de IA atingiu o limite de pedidos. Tenta novamente mais tarde.":"Le service d’IA a atteint sa limite de requêtes. Réessayez plus tard.","Não foi possível analisar a fatura. Confirma a configuração do serviço de IA e tenta novamente.":"Impossible d’analyser le reçu. Vérifiez la configuration du service d’IA et réessayez.","O ficheiro não pôde ser analisado. Tenta usar uma imagem mais nítida ou um PDF legível.":"Impossible d’analyser le fichier. Essayez une image plus nette ou un PDF lisible.","Seleciona primeiro uma fotografia ou PDF da fatura.":"Sélectionnez d’abord une photo ou un PDF du reçu.","Usa uma imagem JPG, PNG, WebP ou PDF.":"Utilisez une image JPG, PNG, WebP ou PDF.","O comprovativo deve ter no máximo 10 MB.":"Le justificatif ne doit pas dépasser 10 Mo.","Não foi possível ler o ficheiro.":"Impossible de lire le fichier.","Não foi possível analisar a fatura.":"Impossible d’analyser le reçu.","A IA não conseguiu analisar esta fatura.":"L’IA n’a pas pu analyser ce reçu.","Mais artigos incluídos nas notas":"{count} articles supplémentaires dans les notes.",
    "Lista de compras":"Liste de courses","Faturas":"Reçus","Faturas de compras":"Reçus de courses","Comprovativos acessíveis a todos os membros desta lista.":"Reçus accessibles à tous les membres de cette liste.","Adicionar fatura":"Ajouter un reçu","Antes de guardar, como te devemos identificar?":"Quel nom devons-nous utiliser avant l’enregistrement ?","O teu nome":"Votre nom","Ex.: Ana":"Ex. : Ana","O nome ficará associado às faturas que adicionares nesta lista.":"Votre nom sera associé aux reçus que vous ajoutez à cette liste.","Guardar nome e continuar":"Enregistrer le nom et continuer","Supermercado":"Supermarché","Data da compra":"Date d’achat","Total (€)":"Total (€)","Notas (opcional)":"Notes (facultatif)","Ex.: compras da semana, IVA, descontos…":"Ex. : courses de la semaine, TVA, réductions…","Tirar fotografia ou anexar ficheiro":"Prendre une photo ou joindre un fichier","Ficheiro selecionado":"Fichier sélectionné","Fotografia ou PDF · até 10 MB":"Photo ou PDF · jusqu’à 10 Mo","Carregar ficheiro":"Importer le fichier","A analisar…":"Analyse en cours…","A analisar a fatura com IA…":"Analyse du reçu par l’IA…","A identificar o supermercado, a data, o total, o IVA e os artigos. Isto pode demorar alguns segundos.":"Identification du magasin, de la date, du total, de la TVA et des articles. Cela peut prendre quelques secondes.","Não feches esta página. Vamos preencher os campos automaticamente para confirmares antes de guardar.":"Ne fermez pas cette page. Les champs seront remplis automatiquement pour vérification avant l’enregistrement.","A IA tenta identificar o supermercado, a data, o total, o IVA e os artigos. Revê sempre as sugestões antes de guardar.":"L’IA tente d’identifier le magasin, la date, le total, la TVA et les articles. Vérifiez les suggestions avant l’enregistrement.","Sugestões extraídas — confirma os campos acima":"Suggestions extraites — vérifiez les champs ci-dessus","IVA identificado":"TVA détectée","Artigos identificados":"Articles détectés","Guardar fatura":"Enregistrer le reçu","Faturas partilhadas":"Reçus partagés","fatura":"reçu","faturas":"reçus","Ainda não há faturas":"Aucun reçu pour le moment","Adiciona o primeiro comprovativo para ficar disponível a toda a família.":"Ajoutez le premier justificatif pour le rendre accessible à toute la famille.","Membro":"Membre","Abrir comprovativo":"Ouvrir le justificatif"
  },
  de: {
    "Secções da lista":"Listenbereiche","Apagar fatura":"Beleg löschen","Filtrar por categoria":"Nach Kategorie filtern","Idioma":"Sprache","Método não permitido.":"Methode nicht erlaubt.","O serviço de IA ainda não está configurado no Supabase. Define o segredo GEMINI_API_KEY.":"Der KI-Dienst ist in Supabase noch nicht eingerichtet. Lege das Secret GEMINI_API_KEY fest.","Formato não suportado. Usa JPG, PNG, WebP ou PDF.":"Nicht unterstütztes Format. Verwende JPG, PNG, WebP oder PDF.","O ficheiro está vazio ou excede o limite de 10 MB.":"Die Datei ist leer oder größer als 10 MB.","O serviço de IA atingiu o limite de pedidos. Tenta novamente mais tarde.":"Der KI-Dienst hat sein Anfrage-Limit erreicht. Versuche es später erneut.","Não foi possível analisar a fatura. Confirma a configuração do serviço de IA e tenta novamente.":"Der Beleg konnte nicht analysiert werden. Prüfe die KI-Dienstkonfiguration und versuche es erneut.","O ficheiro não pôde ser analisado. Tenta usar uma imagem mais nítida ou um PDF legível.":"Die Datei konnte nicht analysiert werden. Verwende ein schärferes Bild oder ein lesbares PDF.","Seleciona primeiro uma fotografia ou PDF da fatura.":"Wähle zuerst ein Foto oder PDF des Belegs aus.","Usa uma imagem JPG, PNG, WebP ou PDF.":"Verwende ein JPG-, PNG-, WebP- oder PDF-Bild.","O comprovativo deve ter no máximo 10 MB.":"Der Beleg darf höchstens 10 MB groß sein.","Não foi possível ler o ficheiro.":"Die Datei konnte nicht gelesen werden.","Não foi possível analisar a fatura.":"Der Beleg konnte nicht analysiert werden.","A IA não conseguiu analisar esta fatura.":"Die KI konnte diesen Beleg nicht analysieren.","Mais artigos incluídos nas notas":"{count} weitere Artikel in den Notizen.",
    "Lista de compras":"Einkaufsliste","Faturas":"Belege","Faturas de compras":"Einkaufsbelege","Comprovativos acessíveis a todos os membros desta lista.":"Belege sind für alle Mitglieder dieser Liste verfügbar.","Adicionar fatura":"Beleg hinzufügen","Antes de guardar, como te devemos identificar?":"Welchen Namen sollen wir vor dem Speichern verwenden?","O teu nome":"Dein Name","Ex.: Ana":"z. B. Anna","O nome ficará associado às faturas que adicionares nesta lista.":"Dein Name wird den Belegen zugeordnet, die du dieser Liste hinzufügst.","Guardar nome e continuar":"Namen speichern und fortfahren","Supermercado":"Supermarkt","Data da compra":"Einkaufsdatum","Total (€)":"Gesamt (€)","Notas (opcional)":"Notizen (optional)","Ex.: compras da semana, IVA, descontos…":"z. B. Wocheneinkauf, MwSt., Rabatte…","Tirar fotografia ou anexar ficheiro":"Foto aufnehmen oder Datei anhängen","Ficheiro selecionado":"Datei ausgewählt","Fotografia ou PDF · até 10 MB":"Foto oder PDF · bis zu 10 MB","Carregar ficheiro":"Datei hochladen","A analisar…":"Wird analysiert…","A analisar a fatura com IA…":"Beleg wird mit KI analysiert…","A identificar o supermercado, a data, o total, o IVA e os artigos. Isto pode demorar alguns segundos.":"Geschäft, Datum, Gesamtbetrag, MwSt. und Artikel werden ermittelt. Das kann einige Sekunden dauern.","Não feches esta página. Vamos preencher os campos automaticamente para confirmares antes de guardar.":"Schließe diese Seite nicht. Die Felder werden automatisch ausgefüllt, damit du sie vor dem Speichern prüfen kannst.","A IA tenta identificar o supermercado, a data, o total, o IVA e os artigos. Revê sempre as sugestões antes de guardar.":"Die KI versucht, Geschäft, Datum, Gesamtbetrag, MwSt. und Artikel zu erkennen. Prüfe die Vorschläge vor dem Speichern.","Sugestões extraídas — confirma os campos acima":"Erkannte Vorschläge — prüfe die Felder oben","IVA identificado":"MwSt. erkannt","Artigos identificados":"Erkannte Artikel","Guardar fatura":"Beleg speichern","Faturas partilhadas":"Geteilte Belege","fatura":"Beleg","faturas":"Belege","Ainda não há faturas":"Noch keine Belege","Adiciona o primeiro comprovativo para ficar disponível a toda a família.":"Füge den ersten Beleg hinzu, damit ihn die ganze Familie sehen kann.","Membro":"Mitglied","Abrir comprovativo":"Beleg öffnen"
  },
  it: {
    "Secções da lista":"Sezioni della lista","Apagar fatura":"Elimina scontrino","Filtrar por categoria":"Filtra per categoria","Idioma":"Lingua","Método não permitido.":"Metodo non consentito.","O serviço de IA ainda não está configurado no Supabase. Define o segredo GEMINI_API_KEY.":"Il servizio IA non è ancora configurato in Supabase. Imposta il segreto GEMINI_API_KEY.","Formato não suportado. Usa JPG, PNG, WebP ou PDF.":"Formato non supportato. Usa JPG, PNG, WebP o PDF.","O ficheiro está vazio ou excede o limite de 10 MB.":"Il file è vuoto o supera il limite di 10 MB.","O serviço de IA atingiu o limite de pedidos. Tenta novamente mais tarde.":"Il servizio IA ha raggiunto il limite di richieste. Riprova più tardi.","Não foi possível analisar a fatura. Confirma a configuração do serviço de IA e tenta novamente.":"Impossibile analizzare lo scontrino. Controlla la configurazione del servizio IA e riprova.","O ficheiro não pôde ser analisado. Tenta usar uma imagem mais nítida ou um PDF legível.":"Impossibile analizzare il file. Prova con un’immagine più nitida o un PDF leggibile.","Seleciona primeiro uma fotografia ou PDF da fatura.":"Seleziona prima una foto o un PDF dello scontrino.","Usa uma imagem JPG, PNG, WebP ou PDF.":"Usa un’immagine JPG, PNG, WebP o PDF.","O comprovativo deve ter no máximo 10 MB.":"Lo scontrino non deve superare i 10 MB.","Não foi possível ler o ficheiro.":"Impossibile leggere il file.","Não foi possível analisar a fatura.":"Impossibile analizzare lo scontrino.","A IA não conseguiu analisar esta fatura.":"L’IA non è riuscita ad analizzare questo scontrino.","Mais artigos incluídos nas notas":"Altri {count} articoli inclusi nelle note.",
    "Lista de compras":"Lista della spesa","Faturas":"Scontrini","Faturas de compras":"Scontrini della spesa","Comprovativos acessíveis a todos os membros desta lista.":"Scontrini accessibili a tutti i membri di questa lista.","Adicionar fatura":"Aggiungi scontrino","Antes de guardar, como te devemos identificar?":"Quale nome dobbiamo usare prima di salvare?","O teu nome":"Il tuo nome","Ex.: Ana":"Es.: Anna","O nome ficará associado às faturas que adicionares nesta lista.":"Il tuo nome sarà associato agli scontrini che aggiungi a questa lista.","Guardar nome e continuar":"Salva il nome e continua","Supermercado":"Supermercato","Data da compra":"Data dell’acquisto","Total (€)":"Totale (€)","Notas (opcional)":"Note (facoltative)","Ex.: compras da semana, IVA, descontos…":"Es.: spesa settimanale, IVA, sconti…","Tirar fotografia ou anexar ficheiro":"Scatta una foto o allega un file","Ficheiro selecionado":"File selezionato","Fotografia ou PDF · até 10 MB":"Foto o PDF · fino a 10 MB","Carregar ficheiro":"Carica file","A analisar…":"Analisi in corso…","A analisar a fatura com IA…":"Analisi dello scontrino con IA…","A identificar o supermercado, a data, o total, o IVA e os artigos. Isto pode demorar alguns segundos.":"Identificazione del negozio, della data, del totale, dell’IVA e degli articoli. Potrebbero volerci alcuni secondi.","Não feches esta página. Vamos preencher os campos automaticamente para confirmares antes de guardar.":"Non chiudere questa pagina. Compileremo automaticamente i campi da verificare prima del salvataggio.","A IA tenta identificar o supermercado, a data, o total, o IVA e os artigos. Revê sempre as sugestões antes de guardar.":"L’IA prova a identificare negozio, data, totale, IVA e articoli. Controlla sempre i suggerimenti prima di salvare.","Sugestões extraídas — confirma os campos acima":"Suggerimenti estratti — controlla i campi sopra","IVA identificado":"IVA rilevata","Artigos identificados":"Articoli rilevati","Guardar fatura":"Salva scontrino","Faturas partilhadas":"Scontrini condivisi","fatura":"scontrino","faturas":"scontrini","Ainda não há faturas":"Nessuno scontrino","Adiciona o primeiro comprovativo para ficar disponível a toda a família.":"Aggiungi il primo scontrino per renderlo disponibile a tutta la famiglia.","Membro":"Membro","Abrir comprovativo":"Apri scontrino"
  },
  nl: {
    "Secções da lista":"Lijstsecties","Apagar fatura":"Bon verwijderen","Filtrar por categoria":"Filteren op categorie","Idioma":"Taal","Método não permitido.":"Methode niet toegestaan.","O serviço de IA ainda não está configurado no Supabase. Define o segredo GEMINI_API_KEY.":"De AI-service is nog niet ingesteld in Supabase. Stel het geheim GEMINI_API_KEY in.","Formato não suportado. Usa JPG, PNG, WebP ou PDF.":"Niet-ondersteund formaat. Gebruik JPG, PNG, WebP of PDF.","O ficheiro está vazio ou excede o limite de 10 MB.":"Het bestand is leeg of groter dan 10 MB.","O serviço de IA atingiu o limite de pedidos. Tenta novamente mais tarde.":"De AI-service heeft de aanvraaglimiet bereikt. Probeer het later opnieuw.","Não foi possível analisar a fatura. Confirma a configuração do serviço de IA e tenta novamente.":"De bon kon niet worden geanalyseerd. Controleer de AI-configuratie en probeer het opnieuw.","O ficheiro não pôde ser analisado. Tenta usar uma imagem mais nítida ou um PDF legível.":"Het bestand kon niet worden geanalyseerd. Probeer een scherpere afbeelding of leesbare PDF.","Seleciona primeiro uma fotografia ou PDF da fatura.":"Selecteer eerst een foto of pdf van de bon.","Usa uma imagem JPG, PNG, WebP ou PDF.":"Gebruik een JPG-, PNG-, WebP- of PDF-afbeelding.","O comprovativo deve ter no máximo 10 MB.":"De bon mag maximaal 10 MB groot zijn.","Não foi possível ler o ficheiro.":"Het bestand kon niet worden gelezen.","Não foi possível analisar a fatura.":"De bon kon niet worden geanalyseerd.","A IA não conseguiu analisar esta fatura.":"De AI kon deze bon niet analyseren.","Mais artigos incluídos nas notas":"Nog {count} artikelen in de notities.",
    "Lista de compras":"Boodschappenlijst","Faturas":"Bonnen","Faturas de compras":"Boodschappenbonnen","Comprovativos acessíveis a todos os membros desta lista.":"Bonnen zijn beschikbaar voor alle leden van deze lijst.","Adicionar fatura":"Bon toevoegen","Antes de guardar, como te devemos identificar?":"Welke naam moeten we gebruiken voordat we opslaan?","O teu nome":"Je naam","Ex.: Ana":"Bijv. Anna","O nome ficará associado às faturas que adicionares nesta lista.":"Je naam wordt gekoppeld aan de bonnen die je aan deze lijst toevoegt.","Guardar nome e continuar":"Naam opslaan en doorgaan","Supermercado":"Supermarkt","Data da compra":"Aankoopdatum","Total (€)":"Totaal (€)","Notas (opcional)":"Notities (optioneel)","Ex.: compras da semana, IVA, descontos…":"Bijv. weekboodschappen, btw, kortingen…","Tirar fotografia ou anexar ficheiro":"Maak een foto of voeg een bestand toe","Ficheiro selecionado":"Bestand geselecteerd","Fotografia ou PDF · até 10 MB":"Foto of pdf · maximaal 10 MB","Carregar ficheiro":"Bestand uploaden","A analisar…":"Bezig met analyseren…","A analisar a fatura com IA…":"Bon analyseren met AI…","A identificar o supermercado, a data, o total, o IVA e os artigos. Isto pode demorar alguns segundos.":"Winkel, datum, totaal, btw en artikelen worden herkend. Dit kan enkele seconden duren.","Não feches esta página. Vamos preencher os campos automaticamente para confirmares antes de guardar.":"Sluit deze pagina niet. We vullen de velden automatisch in zodat je ze kunt controleren voordat je opslaat.","A IA tenta identificar o supermercado, a data, o total, o IVA e os artigos. Revê sempre as sugestões antes de guardar.":"De AI probeert de winkel, datum, het totaal, de btw en artikelen te herkennen. Controleer de suggesties voordat je opslaat.","Sugestões extraídas — confirma os campos acima":"Geëxtraheerde suggesties — controleer de velden hierboven","IVA identificado":"Btw herkend","Artigos identificados":"Artikelen herkend","Guardar fatura":"Bon opslaan","Faturas partilhadas":"Gedeelde bonnen","fatura":"bon","faturas":"bonnen","Ainda não há faturas":"Nog geen bonnen","Adiciona o primeiro comprovativo para ficar disponível a toda a família.":"Voeg de eerste bon toe zodat iedereen in het gezin deze kan bekijken.","Membro":"Lid","Abrir comprovativo":"Bon openen"
  },
  pl: {
    "Secções da lista":"Sekcje listy","Apagar fatura":"Usuń paragon","Filtrar por categoria":"Filtruj według kategorii","Idioma":"Język","Método não permitido.":"Metoda niedozwolona.","O serviço de IA ainda não está configurado no Supabase. Define o segredo GEMINI_API_KEY.":"Usługa AI nie jest jeszcze skonfigurowana w Supabase. Ustaw sekret GEMINI_API_KEY.","Formato não suportado. Usa JPG, PNG, WebP ou PDF.":"Nieobsługiwany format. Użyj JPG, PNG, WebP lub PDF.","O ficheiro está vazio ou excede o limite de 10 MB.":"Plik jest pusty lub przekracza limit 10 MB.","O serviço de IA atingiu o limite de pedidos. Tenta novamente mais tarde.":"Usługa AI osiągnęła limit żądań. Spróbuj ponownie później.","Não foi possível analisar a fatura. Confirma a configuração do serviço de IA e tenta novamente.":"Nie udało się przeanalizować paragonu. Sprawdź konfigurację AI i spróbuj ponownie.","O ficheiro não pôde ser analisado. Tenta usar uma imagem mais nítida ou um PDF legível.":"Nie udało się przeanalizować pliku. Użyj wyraźniejszego obrazu lub czytelnego PDF-a.","Seleciona primeiro uma fotografia ou PDF da fatura.":"Najpierw wybierz zdjęcie lub PDF paragonu.","Usa uma imagem JPG, PNG, WebP ou PDF.":"Użyj obrazu JPG, PNG, WebP lub PDF.","O comprovativo deve ter no máximo 10 MB.":"Paragon nie może przekraczać 10 MB.","Não foi possível ler o ficheiro.":"Nie udało się odczytać pliku.","Não foi possível analisar a fatura.":"Nie udało się przeanalizować paragonu.","A IA não conseguiu analisar esta fatura.":"AI nie udało się przeanalizować tego paragonu.","Mais artigos incluídos nas notas":"Jeszcze {count} produktów w notatkach.",
    "Lista de compras":"Lista zakupów","Faturas":"Paragony","Faturas de compras":"Paragony zakupowe","Comprovativos acessíveis a todos os membros desta lista.":"Paragony dostępne dla wszystkich członków tej listy.","Adicionar fatura":"Dodaj paragon","Antes de guardar, como te devemos identificar?":"Jak mamy Cię zidentyfikować przed zapisaniem?","O teu nome":"Twoje imię","Ex.: Ana":"Np. Anna","O nome ficará associado às faturas que adicionares nesta lista.":"Twoje imię będzie przypisane do paragonów dodanych do tej listy.","Guardar nome e continuar":"Zapisz imię i kontynuuj","Supermercado":"Sklep","Data da compra":"Data zakupu","Total (€)":"Suma (€)","Notas (opcional)":"Notatki (opcjonalnie)","Ex.: compras da semana, IVA, descontos…":"Np. zakupy tygodniowe, VAT, rabaty…","Tirar fotografia ou anexar ficheiro":"Zrób zdjęcie lub dołącz plik","Ficheiro selecionado":"Wybrano plik","Fotografia ou PDF · até 10 MB":"Zdjęcie lub PDF · do 10 MB","Carregar ficheiro":"Prześlij plik","A analisar…":"Analizowanie…","A analisar a fatura com IA…":"Analizowanie paragonu przez AI…","A identificar o supermercado, a data, o total, o IVA e os artigos. Isto pode demorar alguns segundos.":"Rozpoznawanie sklepu, daty, sumy, VAT-u i produktów. Może to potrwać kilka sekund.","Não feches esta página. Vamos preencher os campos automaticamente para confirmares antes de guardar.":"Nie zamykaj tej strony. Pola zostaną wypełnione automatycznie do sprawdzenia przed zapisaniem.","A IA tenta identificar o supermercado, a data, o total, o IVA e os artigos. Revê sempre as sugestões antes de guardar.":"AI próbuje rozpoznać sklep, datę, sumę, VAT i produkty. Sprawdź sugestie przed zapisaniem.","Sugestões extraídas — confirma os campos acima":"Rozpoznane dane — sprawdź powyższe pola","IVA identificado":"Rozpoznano VAT","Artigos identificados":"Rozpoznane produkty","Guardar fatura":"Zapisz paragon","Faturas partilhadas":"Udostępnione paragony","fatura":"paragon","faturas":"paragony","Ainda não há faturas":"Brak paragonów","Adiciona o primeiro comprovativo para ficar disponível a toda a família.":"Dodaj pierwszy paragon, aby był dostępny dla całej rodziny.","Membro":"Członek","Abrir comprovativo":"Otwórz paragon"
  },
  ro: {
    "Secções da lista":"Secțiunile listei","Apagar fatura":"Șterge bonul","Filtrar por categoria":"Filtrează după categorie","Idioma":"Limbă","Método não permitido.":"Metodă nepermisă.","O serviço de IA ainda não está configurado no Supabase. Define o segredo GEMINI_API_KEY.":"Serviciul AI nu este încă configurat în Supabase. Setează secretul GEMINI_API_KEY.","Formato não suportado. Usa JPG, PNG, WebP ou PDF.":"Format neacceptat. Folosește JPG, PNG, WebP sau PDF.","O ficheiro está vazio ou excede o limite de 10 MB.":"Fișierul este gol sau depășește limita de 10 MB.","O serviço de IA atingiu o limite de pedidos. Tenta novamente mais tarde.":"Serviciul AI a atins limita de solicitări. Încearcă din nou mai târziu.","Não foi possível analisar a fatura. Confirma a configuração do serviço de IA e tenta novamente.":"Bonul nu a putut fi analizat. Verifică setările serviciului AI și încearcă din nou.","O ficheiro não pôde ser analisado. Tenta usar uma imagem mais nítida ou um PDF legível.":"Fișierul nu a putut fi analizat. Încearcă o imagine mai clară sau un PDF lizibil.","Seleciona primeiro uma fotografia ou PDF da fatura.":"Selectează mai întâi o fotografie sau un PDF al bonului.","Usa uma imagem JPG, PNG, WebP ou PDF.":"Folosește o imagine JPG, PNG, WebP sau PDF.","O comprovativo deve ter no máximo 10 MB.":"Bonul nu trebuie să depășească 10 MB.","Não foi possível ler o ficheiro.":"Fișierul nu a putut fi citit.","Não foi possível analisar a fatura.":"Bonul nu a putut fi analizat.","A IA não conseguiu analisar esta fatura.":"AI nu a putut analiza acest bon.","Mais artigos incluídos nas notas":"Încă {count} produse incluse în note.",
    "Lista de compras":"Listă de cumpărături","Faturas":"Bonuri","Faturas de compras":"Bonuri de cumpărături","Comprovativos acessíveis a todos os membros desta lista.":"Bonuri accesibile tuturor membrilor acestei liste.","Adicionar fatura":"Adaugă bon","Antes de guardar, como te devemos identificar?":"Ce nume să folosim înainte de salvare?","O teu nome":"Numele tău","Ex.: Ana":"Ex.: Ana","O nome ficará associado às faturas que adicionares nesta lista.":"Numele tău va fi asociat bonurilor adăugate în această listă.","Guardar nome e continuar":"Salvează numele și continuă","Supermercado":"Supermarket","Data da compra":"Data cumpărării","Total (€)":"Total (€)","Notas (opcional)":"Note (opțional)","Ex.: compras da semana, IVA, descontos…":"Ex.: cumpărături săptămânale, TVA, reduceri…","Tirar fotografia ou anexar ficheiro":"Fă o fotografie sau atașează un fișier","Ficheiro selecionado":"Fișier selectat","Fotografia ou PDF · até 10 MB":"Fotografie sau PDF · până la 10 MB","Carregar ficheiro":"Încarcă fișierul","A analisar…":"Se analizează…","A analisar a fatura com IA…":"Bonul este analizat cu AI…","A identificar o supermercado, a data, o total, o IVA e os artigos. Isto pode demorar alguns segundos.":"Se identifică magazinul, data, totalul, TVA-ul și produsele. Poate dura câteva secunde.","Não feches esta página. Vamos preencher os campos automaticamente para confirmares antes de guardar.":"Nu închide pagina. Vom completa automat câmpurile pentru a le verifica înainte de salvare.","A IA tenta identificar o supermercado, a data, o total, o IVA e os artigos. Revê sempre as sugestões antes de guardar.":"AI încearcă să identifice magazinul, data, totalul, TVA-ul și produsele. Verifică sugestiile înainte de salvare.","Sugestões extraídas — confirma os campos acima":"Sugestii extrase — verifică câmpurile de mai sus","IVA identificado":"TVA identificat","Artigos identificados":"Produse identificate","Guardar fatura":"Salvează bonul","Faturas partilhadas":"Bonuri partajate","fatura":"bon","faturas":"bonuri","Ainda não há faturas":"Nu există încă bonuri","Adiciona o primeiro comprovativo para ficar disponível a toda a família.":"Adaugă primul bon pentru a fi disponibil întregii familii.","Membro":"Membru","Abrir comprovativo":"Deschide bonul"
  },
  "zh-CN": {
    "Secções da lista":"清单栏目","Apagar fatura":"删除收据","Filtrar por categoria":"按类别筛选","Idioma":"语言","Método não permitido.":"不允许的方法。","O serviço de IA ainda não está configurado no Supabase. Define o segredo GEMINI_API_KEY.":"Supabase 中尚未配置 AI 服务。请设置 GEMINI_API_KEY 密钥。","Formato não suportado. Usa JPG, PNG, WebP ou PDF.":"不支持的格式。请使用 JPG、PNG、WebP 或 PDF。","O ficheiro está vazio ou excede o limite de 10 MB.":"文件为空或超过 10 MB 限制。","O serviço de IA atingiu o limite de pedidos. Tenta novamente mais tarde.":"AI 服务已达到请求上限，请稍后重试。","Não foi possível analisar a fatura. Confirma a configuração do serviço de IA e tenta novamente.":"无法分析收据。请检查 AI 服务配置后重试。","O ficheiro não pôde ser analisado. Tenta usar uma imagem mais nítida ou um PDF legível.":"无法分析文件。请尝试更清晰的图片或可读取的 PDF。","Seleciona primeiro uma fotografia ou PDF da fatura.":"请先选择收据照片或 PDF。","Usa uma imagem JPG, PNG, WebP ou PDF.":"请使用 JPG、PNG、WebP 或 PDF 文件。","O comprovativo deve ter no máximo 10 MB.":"收据文件不能超过 10 MB。","Não foi possível ler o ficheiro.":"无法读取文件。","Não foi possível analisar a fatura.":"无法分析收据。","A IA não conseguiu analisar esta fatura.":"AI 无法分析此收据。","Mais artigos incluídos nas notas":"备注中还包含 {count} 个商品。",
    "Lista de compras":"购物清单","Faturas":"收据","Faturas de compras":"购物收据","Comprovativos acessíveis a todos os membros desta lista.":"此清单的所有成员均可查看收据。","Adicionar fatura":"添加收据","Antes de guardar, como te devemos identificar?":"保存前，请问如何称呼你？","O teu nome":"你的姓名","Ex.: Ana":"例如：小安","O nome ficará associado às faturas que adicionares nesta lista.":"你的姓名将与添加到此清单的收据关联。","Guardar nome e continuar":"保存姓名并继续","Supermercado":"超市","Data da compra":"购买日期","Total (€)":"总计 (€)","Notas (opcional)":"备注（可选）","Ex.: compras da semana, IVA, descontos…":"例如：每周购物、税额、折扣…","Tirar fotografia ou anexar ficheiro":"拍照或添加文件","Ficheiro selecionado":"已选择文件","Fotografia ou PDF · até 10 MB":"照片或 PDF · 最大 10 MB","Carregar ficheiro":"上传文件","A analisar…":"正在分析…","A analisar a fatura com IA…":"正在使用 AI 分析收据…","A identificar o supermercado, a data, o total, o IVA e os artigos. Isto pode demorar alguns segundos.":"正在识别商店、日期、总额、税额和商品，可能需要几秒钟。","Não feches esta página. Vamos preencher os campos automaticamente para confirmares antes de guardar.":"请勿关闭此页面。系统将自动填写字段，请在保存前核对。","A IA tenta identificar o supermercado, a data, o total, o IVA e os artigos. Revê sempre as sugestões antes de guardar.":"AI 将尝试识别商店、日期、总额、税额和商品。保存前请务必检查建议内容。","Sugestões extraídas — confirma os campos acima":"已提取建议——请检查上方字段","IVA identificado":"已识别税额","Artigos identificados":"已识别商品","Guardar fatura":"保存收据","Faturas partilhadas":"共享收据","fatura":"收据","faturas":"收据","Ainda não há faturas":"暂无收据","Adiciona o primeiro comprovativo para ficar disponível a toda a família.":"添加第一张收据，供全家查看。","Membro":"成员","Abrir comprovativo":"打开收据"
  }
};
function tx(text, lang) {
  if (!lang || lang === "pt-PT") return text;
  return RECEIPTS_TABS_I18N[lang]?.[text] || AUDIT_I18N[lang]?.[text] || EXTRA_I18N[lang]?.[text] || I18N[lang]?.[text] || EXTRA_I18N.en[text] || I18N.en[text] || text;
}
const LANGUAGE_FLAGS = {
  "pt-PT": "🇵🇹", en: "🇬🇧", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪",
  it: "🇮🇹", nl: "🇳🇱", pl: "🇵🇱", ro: "🇷🇴", "zh-CN": "🇨🇳"
};

function LanguagePicker({ language, onChange }) {
  const selectedLanguage = LANGUAGE_OPTIONS.find(([code]) => code === language);
  return <label className="language-picker" aria-label={tx("Idioma", language)}>
    <span className="language-flag" aria-hidden="true">{LANGUAGE_FLAGS[language] || "🌐"}</span>
    <select value={language} onChange={e => onChange(e.target.value)} aria-label="Idioma" title={selectedLanguage?.[1] || "Idioma"}>
      {LANGUAGE_OPTIONS.map(([code, label]) => <option key={code} value={code}>{LANGUAGE_FLAGS[code]} {label}</option>)}
    </select>
  </label>;
}

function getDeviceId() { let id = localStorage.getItem("listora-device-id"); if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : "device-" + Date.now() + "-" + Math.random().toString(36).slice(2); localStorage.setItem("listora-device-id", id); } return id; }



export default function App() {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem("lista-familia-language");
    if (saved && LANGUAGE_OPTIONS.some(([code]) => code === saved)) return saved;
    const browserLanguage = (navigator.language || "pt-PT").toLowerCase();
    if (browserLanguage.startsWith("zh")) return "zh-CN";
    return LANGUAGE_OPTIONS.find(([code]) => browserLanguage.startsWith(code.toLowerCase().split("-")[0]))?.[0] || "pt-PT";
  });
  const t = (text, params) => {
    const translated = tx(text, language);
    return params ? translated.replace(/\{(\w+)\}/g, (match, key) => params[key] === undefined ? match : String(params[key])) : translated;
  };
  useEffect(() => { localStorage.setItem("lista-familia-language", language); }, [language]);

  const [listCode, setListCode] = useState(() => (new URLSearchParams(window.location.search).get("join") || new URLSearchParams(window.location.search).get("list") || localStorage.getItem("lista-familia-code") || "").toUpperCase());
  const [memberName, setMemberName] = useState(() => localStorage.getItem("listora-member-name") || "");
  const [memberNameInput, setMemberNameInput] = useState(() => localStorage.getItem("listora-member-name") || "");
  const [memberId, setMemberId] = useState(() => getDeviceId());
  const [activeTab, setActiveTab] = useState("shopping");
  const [receipts, setReceipts] = useState([]);
  const [receiptStore, setReceiptStore] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0,10));
  const [receiptTotal, setReceiptTotal] = useState("");
  const [receiptNotes, setReceiptNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptExtractBusy, setReceiptExtractBusy] = useState(false);
  const [receiptExtraction, setReceiptExtraction] = useState(null);
  const [receiptNeedsName, setReceiptNeedsName] = useState(false);
  const channelRef = useRef(null);
  const [list, setList] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(() => localStorage.getItem("listora-install-dismissed") === "1" || localStorage.getItem("listora-installed") === "1");
  const [isStandalone, setIsStandalone] = useState(() => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
  const displayListName = list && ["Compras da família", "Family shopping", "Compra familiar"].includes(list.name) ? t("Compras da família") : list?.name;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("");
  const [showOtherProducts, setShowOtherProducts] = useState(false);
  const [showPhotoSource, setShowPhotoSource] = useState(false);
  const [otherProductSearch, setOtherProductSearch] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState("auto");
  const [filter, setFilter] = useState("all");
  const [showDone, setShowDone] = useState(false);
  const [shoppingMode, setShoppingMode] = useState(false);
  const [showShoppingNudge, setShowShoppingNudge] = useState(true);
  const [itemsSectionVisible, setItemsSectionVisible] = useState(false);
  const [templates, setTemplates] = useState(() => { try { return JSON.parse(localStorage.getItem("lista-familia-templates") || "[]"); } catch { return []; } });
  const [itemHistory, setItemHistory] = useState(() => { try { return JSON.parse(localStorage.getItem("lista-familia-item-history") || "[]"); } catch { return []; } });
  const initialInviteCode = new URLSearchParams(window.location.search).get("join") || "";
  const [joinCode, setJoinCode] = useState(() => (initialInviteCode || localStorage.getItem("lista-familia-code") || "").toUpperCase());
  const [inviteList, setInviteList] = useState(null);
  const [inviteLookupBusy, setInviteLookupBusy] = useState(false);
  const [inviteDismissed, setInviteDismissed] = useState(false);
  const [inviteAccepted, setInviteAccepted] = useState(false);
  const [listName, setListName] = useState(() => tx("Compras da família", language));
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [showDiscover, setShowDiscover] = useState(() => window.location.hash === "#descobrir");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showListMenu, setShowListMenu] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [installHelpNeedsSafari, setInstallHelpNeedsSafari] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importSource, setImportSource] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const imageInputRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const imageCameraInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const activeItems = useMemo(() => items.filter(i => !i.done), [items]);
  const doneItems = useMemo(() => items.filter(i => i.done), [items]);
  const visibleItems = useMemo(() => {
    const source = shoppingMode ? (showDone ? doneItems : activeItems) : (showDone ? items : activeItems);
    return source.filter(i => filter === "all" || i.category === filter);
  }, [items, activeItems, doneItems, filter, showDone, shoppingMode]);
  const shoppingProgress = items.length ? Math.round((doneItems.length / items.length) * 100) : 0;
  const suggestions = useMemo(() => [...new Map([...items.map(item => item.name), ...itemHistory].map(value => [value.toLocaleLowerCase(), value])).values()].slice(0, 30), [items, itemHistory]);

  useEffect(() => {
    if (!listCode || !isSupabaseConfigured) return;
    let alive = true;
    setLoading(true);
    supabase.rpc("get_family_list", { p_share_code: listCode })
      .then(({ data, error: rpcError }) => {
        if (!alive) return;
        if (rpcError || !data?.list) throw rpcError || new Error(t("Lista não encontrada."));
        setList(data.list);
        setItems(data.items || []);
        setReceipts(data.receipts || []);
        setError("");
      })
      .catch(() => {
        if (!alive) return;
        localStorage.removeItem("lista-familia-code");
        setListCode("");
        setList(null);
        setItems([]);
        setError(t("Não encontrámos essa lista. Confirma o código e tenta novamente."));
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [listCode]);

  useEffect(() => {
    const syncDiscoverRoute = () => setShowDiscover(window.location.hash === "#descobrir");
    window.addEventListener("hashchange", syncDiscoverRoute);
    window.addEventListener("popstate", syncDiscoverRoute);
    return () => { window.removeEventListener("hashchange", syncDiscoverRoute); window.removeEventListener("popstate", syncDiscoverRoute); };
  }, []);

  function openDiscover() { setShowDiscover(true); if (window.location.hash !== "#descobrir") window.history.pushState({ page: "discover" }, "", "#descobrir"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function closeDiscover() { setShowDiscover(false); if (window.location.hash === "#descobrir") window.history.pushState({}, "", window.location.pathname + window.location.search); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function shareLandingPage() {
    const url = `${window.location.origin}${window.location.pathname}`;
    const shareData = {
      title: "Listora — As compras da família, mais simples",
      text: t("Descobre a Listora: organiza as compras da família numa lista partilhada."),
      url
    };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      notify(t("Link da Listora copiado! Partilha com os teus amigos."));
    } catch {
      window.prompt(t("Copia este link para partilhar a Listora com os teus amigos:"), url);
    }
  }

  useEffect(() => {
    if (!list || !memberName || showOnboarding || localStorage.getItem("listora-onboarding-v3-complete") === "1") return;
    setShowOnboarding(true);
    setOnboardingStep(0);
  }, [list, memberName, showOnboarding]);

  useEffect(() => {
    if (!initialInviteCode || !isSupabaseConfigured) return;
    let active = true;
    setInviteLookupBusy(true);
    supabase.rpc("get_family_list", { p_share_code: initialInviteCode.toUpperCase() }).then(({ data, error: lookupError }) => { if (active && !lookupError && data?.list) setInviteList(data.list); }).catch(() => {}).finally(() => { if (active) setInviteLookupBusy(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (activeTab !== "shopping") { setItemsSectionVisible(false); return; }
    const section = document.querySelector(".items-section");
    if (!section) return;
    const updateVisibility = () => {
      const bounds = section.getBoundingClientRect();
      setItemsSectionVisible(bounds.top < window.innerHeight * 0.82 && bounds.bottom > window.innerHeight * 0.18);
    };
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);
    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, [activeTab, items.length, shoppingMode]);

  useEffect(() => {
    if (!shoppingMode || activeTab !== "shopping") return;
    requestAnimationFrame(() => document.querySelector(".supermarket-summary")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [shoppingMode, activeTab]);

  useEffect(() => {
    const onInstallAvailable = (event) => {
      // Keep Chrome's native install UI available for our own install button.
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      setInstallDismissed(true);
      localStorage.setItem("listora-installed", "1");
      localStorage.setItem("listora-install-dismissed", "1");
    };
    const standaloneQuery = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayModeChange = (event) => {
      if (event.matches || window.navigator.standalone === true) setIsStandalone(true);
    };
    standaloneQuery?.addEventListener?.("change", onDisplayModeChange);
    window.addEventListener("beforeinstallprompt", onInstallAvailable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      standaloneQuery?.removeEventListener?.("change", onDisplayModeChange);
      window.removeEventListener("beforeinstallprompt", onInstallAvailable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installApp() {
    if (isStandalone) return;
    if (!installPrompt) {
      const userAgent = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const isMacSafari = /Macintosh/.test(userAgent) && /Safari/.test(userAgent) && !/Chrome|Chromium|CriOS|Edg/.test(userAgent);
      const isChromiumDesktop = /Chrome|Chromium|Edg/.test(userAgent) && !/Android|iPhone|iPad|iPod/.test(userAgent);
      if (isIOS || isMacSafari) {
        setInstallHelpNeedsSafari(isMacSafari);
        setShowInstallHelp(true);
        return;
      }
      if (isChromiumDesktop) {
        notify(t("O Chrome ainda não disponibilizou a instalação automática. Abre o menu ⋮ e procura ‘Instalar Listora’ ou usa o ícone de instalação na barra de endereço. Se não aparecer, verifica a instalação em chrome://web-app-internals."));
        return;
      }
      notify(t("Este navegador não disponibilizou a instalação automática. Abre o menu do navegador e procura ‘Instalar aplicação’ ou ‘Adicionar ao ecrã principal’."));
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === "accepted") {
        setInstallPrompt(null);
        setInstallDismissed(true);
        localStorage.setItem("listora-installed", "1");
        localStorage.setItem("listora-install-dismissed", "1");
      } else {
        // The prompt event is single-use; wait for a new event before offering it again.
        setInstallPrompt(null);
      }
    } catch (error) {
      console.warn("Listora install prompt failed:", error);
      setInstallPrompt(null);
      notify(t("Não foi possível abrir a instalação automática. Usa o menu do navegador para instalar a Listora."));
    }
  }

  function leaveCurrentList() {
    if (!window.confirm(t("Sair desta lista neste dispositivo? A lista partilhada não será apagada."))) return;
    localStorage.removeItem("lista-familia-code");
    setListCode(""); setList(null); setItems([]); setReceipts([]); setActiveTab("shopping"); setJoinCode(""); setError("");
  }

  useEffect(() => {
    if (!listCode || !list || !isSupabaseConfigured) return;
    let alive = true;
    const channel = supabase.channel(`list:${listCode}`, {
      config: { broadcast: { self: false } }
    });
    channel
      .on("broadcast", { event: "changed" }, async () => {
        const { data, error: rpcError } = await supabase.rpc("get_family_list", { p_share_code: listCode });
        if (alive && !rpcError && data?.list) {
          setList(data.list);
          setItems(data.items || []);
          setReceipts(data.receipts || []);
        }
      })
      .subscribe(status => setConnected(alive && status === "SUBSCRIBED"));
    channelRef.current = channel;
    return () => {
      alive = false;
      channelRef.current = null;
      setConnected(false);
      supabase.removeChannel(channel);
    };
  }, [listCode, !!list]);

  function broadcastChange() {
    channelRef.current?.send({ type: "broadcast", event: "changed", payload: {} });
  }

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  async function createList(e) {
    e?.preventDefault();
    const displayName = memberNameInput.trim().slice(0, 60);
    if (!displayName) { setError(t("Indica o teu nome para poderes criar a lista.")); return; }
    localStorage.setItem("listora-member-name", displayName); setMemberName(displayName);
    setLoading(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("create_family_list", { p_name: listName.trim() || t("Compras da família") });
      if (rpcError) throw rpcError;
      localStorage.setItem("lista-familia-code", data.list.shareCode);
      setListCode(data.list.shareCode);
      setList(data.list);
      setItems(data.items || []); setReceipts(data.receipts || []);
      const deviceId = getDeviceId(); setMemberId(deviceId);
      const { error: memberError } = await supabase.rpc("register_family_member", { p_share_code: data.list.shareCode, p_device_id: deviceId, p_display_name: displayName });
      if (memberError) throw memberError;
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function joinList(e) {
    e?.preventDefault();
    const displayName = memberNameInput.trim().slice(0, 60);
    if (!displayName) { setError(t("Indica o teu nome para entrares na lista.")); return; }
    localStorage.setItem("listora-member-name", displayName); setMemberName(displayName);
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setLoading(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("get_family_list", { p_share_code: code });
      if (rpcError || !data?.list) throw rpcError || new Error("Lista não encontrada.");
      const deviceId = getDeviceId(); setMemberId(deviceId);
      const { error: memberError } = await supabase.rpc("register_family_member", { p_share_code: code, p_device_id: deviceId, p_display_name: displayName });
      if (memberError) throw memberError;
      localStorage.setItem("lista-familia-code", code);
      setListCode(code); setList(data.list); setItems(data.items || []); setReceipts(data.receipts || []);
    } catch (err) { console.error("Listora join failed:", err); setError(err?.message ? `${t("Não foi possível entrar na lista")}: ${err.message}` : t("Não encontrámos essa lista. Confirma o código e tenta novamente.")); }
    finally { setLoading(false); }
  }

  async function submitItem(cleanName, qty = 1, selectedCategory = "auto") {
    if (!cleanName || !listCode) return;
    try {
      const { data, error: rpcError } = await supabase.rpc("add_family_item", {
        p_share_code: listCode, p_name: cleanName, p_quantity: qty,
        p_category: selectedCategory === "auto" ? guessCategory(cleanName) : selectedCategory
      });
      if (rpcError) throw rpcError;
      broadcastChange();
      setItems(data.items);
      setItemHistory(previous => {
        const next = [cleanName, ...previous.filter(value => value.toLocaleLowerCase() !== cleanName.toLocaleLowerCase())].slice(0, 80);
        localStorage.setItem("lista-familia-item-history", JSON.stringify(next));
        return next;
      });
      setName(""); setQuantity("1"); setCategory("auto");
      return true;
    } catch (err) { setError(err.message); return false; }
  }

  function parseGeminiItems(payload) {
    const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "";
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    const source = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(source)) throw new Error("O Gemini não devolveu uma lista válida.");
    return source.map(item => ({
      name: String(item.name || item.product || "").trim().replace(/\s+/g, " ").slice(0, 100),
      quantity: Math.max(1, Math.min(999, Number.parseInt(item.quantity, 10) || 1))
    })).filter(item => item.name).slice(0, 60);
  }

  async function callGemini({ text, image }) {
    const { data, error } = await supabase.functions.invoke("listora-list-extract", {
      body: {
        text: text || "",
        mimeType: image?.mimeType || "",
        fileData: image?.data || ""
      }
    });
    if (error) {
      let detail = error.message || "Não foi possível contactar o serviço de IA.";
      try {
        const context = error.context;
        if (context && typeof context.json === "function") {
          const payload = await context.json();
          detail = payload?.error || payload?.message || detail;
        }
      } catch { /* Keep the original function error. */ }
      throw new Error(detail);
    }
    if (data?.error) throw new Error(data.error);
    return parseGeminiItems({ candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }] });
  }

  async function processPhoto(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setImportError("Escolhe um ficheiro de imagem."); return; }
    if (file.size > 12 * 1024 * 1024) { setImportError("A imagem deve ter menos de 12 MB."); return; }
    setImportError("");
    // The file input (with capture="environment") lets the browser handle camera permission.
    // Do not require getUserMedia here: users may also select an existing image file.
    setImportBusy(true); setImportError(""); setImportSource("photo");
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1];
      const itemsFound = await callGemini({ image: { mimeType: file.type, data: base64 } });
      if (!itemsFound.length) throw new Error("Não consegui identificar produtos. Tenta uma fotografia mais nítida.");
      setImportPreview(itemsFound);
    } catch (err) { setImportError(err.message || "Não foi possível interpretar a imagem."); }
    finally { setImportBusy(false); if (imageInputRef.current) imageInputRef.current.value = ""; }
  }

  async function startVoiceImport() {
    setImportError("");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setImportError(t("O reconhecimento de voz não é suportado neste navegador. Toca no campo do produto e usa o microfone do teclado para ditar."));
      document.querySelector('input[placeholder*="produto"]')?.focus();
      return;
    }
    if (listening) { recognitionRef.current?.stop(); setListening(false); setVoiceModalOpen(false); return; }
    setVoiceModalOpen(true);
    try {
      // Let SpeechRecognition request microphone access itself. A separate getUserMedia prompt can consume the user gesture on Android.
      const recognition = new SpeechRecognition();
      recognition.lang = language === "pt-PT" ? "pt-PT" : language === "en" ? "en-US" : language;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;
      recognition.onstart = () => setListening(true);
      recognition.onerror = event => {
        setListening(false);
        setVoiceModalOpen(false);
        const message = event.error === "not-allowed" || event.error === "service-not-allowed"
          ? t("O acesso ao microfone foi recusado. Permite o microfone nas definições do navegador.")
          : event.error === "network"
            ? t("O reconhecimento de voz precisa de uma ligação à Internet. Verifica a ligação e tenta novamente.")
            : event.error === "no-speech"
              ? t("Não detetámos voz. Toca no microfone e fala depois de aparecer a indicação de escuta.")
              : t("Não foi possível reconhecer a voz. Neste navegador, podes usar o microfone do teclado para ditar no campo do produto.");
        setImportError(message);
      };
      recognition.onnomatch = () => { setImportError(t("Não percebemos os produtos ditos. Tenta falar um pouco mais devagar.")); };
      recognition.onend = () => setListening(false);
      recognition.onresult = async event => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (!transcript) { setImportError(t("Não foi detetada voz. Tenta novamente.")); return; }
        setImportBusy(true); setImportSource("voice"); setImportError("");
        try {
          const itemsFound = await callGemini({ text: transcript });
          if (!itemsFound.length) throw new Error("Não foram identificados produtos na frase. Tenta novamente.");
          setImportPreview(itemsFound);
        } catch (err) { setImportError(err.message || "Não foi possível interpretar a voz."); }
        finally { setImportBusy(false); setVoiceModalOpen(false); }
      };
      recognition.start();
    } catch {
      setListening(false);
      setImportError("Não foi possível iniciar o microfone neste dispositivo.");
    }
  }

  function editPreviewItem(index, changes) {
    setImportPreview(previous => previous.map((item, i) => i === index ? { ...item, ...changes } : item));
  }

  async function confirmImport() {
    const validItems = importPreview.filter(item => item.name.trim()).map(item => ({
      name: item.name.trim().slice(0, 100),
      quantity: Math.max(1, Math.min(999, Number.parseInt(item.quantity, 10) || 1))
    }));
    if (!validItems.length) { setImportError("Adiciona pelo menos um produto."); return; }
    setImportBusy(true); setImportError("");
    let added = 0;
    try {
      for (const item of validItems) {
        if (!await submitItem(item.name, item.quantity, "auto")) throw new Error("Alguns produtos não foram adicionados. Podes tentar novamente.");
        added += 1;
      }
      setImportPreview([]);
      setImportSource("");
      notify(`${added} ${added === 1 ? "produto adicionado" : "produtos adicionados"}`);
    } finally { setImportBusy(false); }
  }

  async function addItem(e) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    const qty = Math.max(1, Math.min(999, Number.parseInt(quantity, 10) || 1));
    await submitItem(cleanName, qty, category);
  }

  async function repeatItem(itemName) {
    if (await submitItem(itemName, 1, "auto")) notify(t("Artigo adicionado novamente"));
  }

  function saveCurrentTemplate() {
    const pending = activeItems.map(item => ({ name: item.name, quantity: item.quantity, category: item.category }));
    if (!pending.length) return;
    const templateName = window.prompt(t("Nome para esta lista reutilizável:"), list.name || t("Compra semanal"));
    if (!templateName || !templateName.trim()) return;
    const next = [{ id: Date.now(), name: templateName.trim().slice(0, 50), items: pending }, ...templates].slice(0, 8);
    setTemplates(next);
    localStorage.setItem("lista-familia-templates", JSON.stringify(next));
    notify(t("Lista guardada neste dispositivo"));
  }

  async function useTemplate(template) {
    for (const item of template.items) {
      const ok = await submitItem(item.name, item.quantity || 1, item.category || "auto");
      if (!ok) return;
    }
    notify(t("Lista reutilizada"));
  }

  async function updateItem(item, changes) {
    try {
      const { data, error: rpcError } = await supabase.rpc("update_family_item", {
        p_share_code: listCode, p_item_id: item._id,
        p_done: changes.done ?? null, p_name: changes.name ?? null,
        p_quantity: changes.quantity ?? null, p_category: changes.category ?? null
      });
      if (rpcError) throw rpcError;
      broadcastChange();
      setItems(data.items);
    } catch (err) { setError(err.message); }
  }

  async function deleteItem(item) {
    try {
      const { data, error: rpcError } = await supabase.rpc("delete_family_item", { p_share_code: listCode, p_item_id: item._id });
      if (rpcError) throw rpcError;
      broadcastChange();
      setItems(data.items);
    } catch (err) { setError(err.message); }
  }

  async function clearDone() {
    if (!window.confirm(t("Queres remover todos os artigos já comprados?"))) return;
    try {
      const { data, error: rpcError } = await supabase.rpc("clear_completed_items", { p_share_code: listCode });
      if (rpcError) throw rpcError;
      broadcastChange();
      setItems(data.items);
      notify(t("Compras concluídas removidas"));
    } catch (err) { setError(err.message); }
  }

  async function clearAllItems() {
    if (!items.length) return;
    if (!window.confirm(t("Queres remover todos os produtos desta lista? Esta ação afeta todos os membros e não pode ser desfeita."))) return;
    try {
      let remainingItems = items;
      for (const item of items) {
        const { data, error: rpcError } = await supabase.rpc("delete_family_item", { p_share_code: listCode, p_item_id: item._id });
        if (rpcError) throw rpcError;
        remainingItems = data.items;
      }
      broadcastChange();
      setItems(remainingItems);
      setShowDone(false);
      notify(t("Todos os produtos foram removidos"));
    } catch (err) { setError(err.message); }
  }

  const inviteUrl = window.location.origin + (import.meta.env.BASE_URL || "/") + "?join=" + encodeURIComponent(listCode);
  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      notify(t("Link de convite copiado!"));
    } catch {
      window.prompt(t("Copia este link e partilha com a família:"), inviteUrl);
    }
  }

  async function shareListCode() {
    const message = "Entra na minha lista da Listora: " + inviteUrl + " (código: " + listCode + ")";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Listora — lista partilhada", text: message, url: inviteUrl });
      } else {
        await navigator.clipboard.writeText(message);
        notify(t("Link de convite copiado!"));
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(listCode);
        notify(t("Código da lista copiado!"));
      } catch {
        window.prompt(t("Copia este link e partilha com a família:"), inviteUrl);
      }
    }
  }

  async function extractReceiptData(file = receiptFile) {
    if (!file) { setError("Seleciona primeiro uma fotografia ou PDF da fatura."); return; }
    if (!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type)) {
      setError("Usa uma imagem JPG, PNG, WebP ou PDF."); return;
    }
    if (file.size > 10 * 1024 * 1024) { setError("O comprovativo deve ter no máximo 10 MB."); return; }
    setReceiptExtractBusy(true); setError(""); setReceiptExtraction(null);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1];
      const { data, error: invokeError } = await supabase.functions.invoke("listora-receipt-extract", {
        body: { mimeType: file.type, fileData: base64, language }
      });
      if (invokeError) {
        const detail = await invokeError.context?.json?.().catch(() => null);
        throw new Error(detail?.error || invokeError.message || "Não foi possível analisar a fatura.");
      }
      if (!data || data.error) throw new Error(data?.error || "A IA não conseguiu analisar esta fatura.");
      if (data.storeName) setReceiptStore(String(data.storeName).slice(0,120));
      if (data.purchasedAt && /^\\d{4}-\\d{2}-\\d{2}$/.test(data.purchasedAt)) setReceiptDate(data.purchasedAt);
      if (data.total !== null && data.total !== undefined && Number.isFinite(Number(data.total))) setReceiptTotal(String(Number(data.total).toFixed(2)));
      const items = Array.isArray(data.items) ? data.items.slice(0,40) : [];
      const detailLines = [];
      if (data.vatTotal !== null && data.vatTotal !== undefined && Number.isFinite(Number(data.vatTotal))) detailLines.push("IVA identificado: €" + Number(data.vatTotal).toFixed(2));
      if (items.length) detailLines.push("Artigos identificados: " + items.map(item => {
        const label = String(item.name || "").trim().slice(0,100);
        const amount = Number(item.total);
        return label + (Number.isFinite(amount) ? " (€" + amount.toFixed(2) + ")" : "");
      }).filter(Boolean).join(", "));
      if (detailLines.length) setReceiptNotes(previous => [previous.trim(), detailLines.join("\\n")].filter(Boolean).join("\\n").slice(0,1000));
      setReceiptExtraction({ items, vatTotal: data.vatTotal, confidence: data.confidence || "medium", warnings: Array.isArray(data.warnings) ? data.warnings : [] });
      notify("Sugestões extraídas. Confirma os campos antes de guardar.");
    } catch (err) {
      setError(err.message || "Não foi possível extrair os dados da fatura.");
    } finally { setReceiptExtractBusy(false); }
  }

  async function addReceipt(e) {
    e.preventDefault();
    if (!receiptStore.trim() || receiptTotal === "" || Number(receiptTotal) < 0) return;
    if (!memberName.trim()) {
      setReceiptNeedsName(true);
      setError("");
      window.setTimeout(() => document.getElementById("receipt-member-name")?.focus(), 0);
      return;
    }
    setReceiptBusy(true); setError("");
    let filePath = null;
    try {
      const receiptId = crypto.randomUUID();
      if (receiptFile) {
        if (receiptFile.size > 10 * 1024 * 1024) throw new Error("O comprovativo deve ter no máximo 10 MB.");
        if (!["image/jpeg","image/png","image/webp","application/pdf"].includes(receiptFile.type)) throw new Error("Usa uma imagem JPG, PNG, WebP ou PDF.");
        filePath = listCode + "/" + receiptId + "/" + receiptFile.name.replace(/[^a-zA-Z0-9._-]/g,"_");
        const { error: uploadError } = await supabase.storage.from("family-receipts").upload(filePath, receiptFile, { contentType: receiptFile.type, upsert: false });
        if (uploadError) throw uploadError;
      }
      const { data, error: rpcError } = await supabase.rpc("add_family_receipt", {
        p_share_code: listCode, p_device_id: memberId, p_store_name: receiptStore.trim(),
        p_purchased_at: receiptDate, p_total: Number(receiptTotal), p_notes: receiptNotes.trim(),
        p_file_path: filePath, p_file_name: receiptFile?.name || null
      });
      if (rpcError) throw rpcError;
      setReceipts(data.receipts || []); setList(data.list || list); broadcastChange();
      setReceiptStore(""); setReceiptTotal(""); setReceiptNotes(""); setReceiptFile(null); setReceiptExtraction(null);
      const input = document.getElementById("receipt-file"); if (input) input.value = "";
      notify("Fatura adicionada à lista partilhada.");
    } catch (err) {
      if (filePath) await supabase.storage.from("family-receipts").remove([filePath]);
      setError(err.message || "Não foi possível guardar a fatura.");
    } finally { setReceiptBusy(false); }
  }

  async function openReceipt(receipt) {
    if (!receipt.filePath) return;
    const { data, error: fileError } = await supabase.storage.from("family-receipts").createSignedUrl(receipt.filePath, 300);
    if (fileError) { setError(fileError.message); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function removeReceipt(receipt) {
    if (!window.confirm("Apagar esta fatura partilhada?")) return;
    try {
      const { data, error: rpcError } = await supabase.rpc("delete_family_receipt", { p_share_code: listCode, p_receipt_id: receipt.id });
      if (rpcError) throw rpcError;
      if (data.filePath) await supabase.storage.from("family-receipts").remove([data.filePath]);
      setReceipts(data.payload?.receipts || []); broadcastChange();
    } catch (err) { setError(err.message); }
  }

  async function copyListCode() {
    try {
      await navigator.clipboard.writeText(listCode);
      notify(t("Código da lista copiado!"));
    } catch {
      window.prompt(t("Copia este link e partilha com a família:"), inviteUrl);
    }
  }

  if (!isSupabaseConfigured) return (
    <main className="loading-screen">
      <div style={{ maxWidth: 520, padding: 24, textAlign: "center" }}>
        <h1>{t("Falta configurar o Supabase")}</h1>
        <p>{t("Cria um projeto Supabase, executa o SQL de")} <code>supabase/migrations</code> {t("e define")} <code>VITE_SUPABASE_URL</code> {t("e")} <code>VITE_SUPABASE_ANON_KEY</code> {t("no ficheiro")} <code>.env.local</code>.</p>
      </div>
    </main>
  );

  if (loading && !list) return <main className="loading-screen"><LoaderCircle className="spin" size={30}/><span>{t("A preparar a tua lista…")}</span></main>;

  if (!listCode || !list || !memberName) return (
    <main className="welcome-page">
      <div className="welcome-glow glow-one" /><div className="welcome-glow glow-two" />
      <header className="welcome-top"><button type="button" className="welcome-home-brand" onClick={closeDiscover} aria-label={t("Voltar à página inicial")}><span className="brand-mark"><ShoppingBasket size={23}/></span><span>List<span className="brand-light">ora</span></span></button><div className="welcome-top-actions"><button type="button" className="discover-share-link" onClick={shareLandingPage}><Share2 size={15}/>{t("Partilhar com família e amigos")}</button><LanguagePicker language={language} onChange={setLanguage}/></div></header>
      {showDiscover ? <section className="discover-content">
        <button type="button" className="discover-back" onClick={closeDiscover}><ArrowLeft size={17}/>{t("Voltar à página inicial")}</button>
        <div className="eyebrow"><Sparkles size={15}/>{t("CONHECE A LISTORA")}</div>
        <h1>{t("As compras da família.")}<br/><span>{t("Mais simples e inteligentes.")}</span></h1>
        <p className="discover-intro">{t("A Listora ajuda a organizar as compras de toda a família num só lugar: da lista partilhada às fotografias, voz e faturas, com ajuda da inteligência artificial.")}</p>
        <button type="button" className="primary-button discover-cta" onClick={closeDiscover}>{t("Criar a minha lista")}<ArrowRight size={18}/></button>
        <div className="discover-feature-grid">
          <article className="discover-feature"><div className="discover-art"><div className="discover-art-paper"><span/><span/><span/><span/></div><span className="discover-art-icon"><Camera size={25}/></span><span className="discover-ai-tag"><Sparkles size={12}/> IA</span></div><span className="discover-kicker">{t("FOTOGRAFIA + IA")}</span><h2>{t("Uma fotografia. Uma lista pronta a rever.")}</h2><p>{t("Fotografa uma lista manuscrita, uma folha de papel ou um quadro. A inteligência artificial analisa a imagem e identifica os produtos para confirmares antes de adicionar.")}</p></article>
          <article className="discover-feature"><div className="discover-art"><div className="discover-voice-orb"><Mic size={29}/></div><div className="discover-wave">{[10,18,28,16,34,21,13,26,17].map((h,i)=><i key={i} style={{height:h}}/>)}</div><span className="discover-ai-tag"><Sparkles size={12}/> IA</span></div><span className="discover-kicker">{t("VOZ + IA")}</span><h2>{t("Diz vários produtos de seguida.")}</h2><p>{t("Diz, por exemplo, «leite, pão e seis ovos». A inteligência artificial interpreta a voz e prepara os produtos para reveres e adicionares à lista.")}</p></article>
          <article className="discover-feature"><div className="discover-art"><div className="discover-receipt-art"><Receipt size={25}/><span/><span/><b>24,80 €</b></div><span className="discover-art-icon"><Camera size={22}/></span></div><span className="discover-kicker">{t("FATURAS")}</span><h2>{t("Guarda as faturas das compras.")}</h2><p>{t("Fotografa as faturas para as guardar na Listora e consultar mais tarde. Os dados que possam ser extraídos por reconhecimento automático devem ser revistos quando necessário.")}</p></article>
          <article className="discover-feature"><div className="discover-art"><div className="discover-family-bubbles"><span>G</span><span>M</span><span>+</span></div><div className="discover-sync-line"><Check size={15}/>{t("Sincronizada")}</div></div><span className="discover-kicker">{t("EM FAMÍLIA")}</span><h2>{t("Todos contribuem para a mesma lista.")}</h2><p>{t("Convida a família e mantém a lista partilhada atualizada para que todos saibam o que falta comprar.")}</p></article>
          <article className="discover-feature"><div className="discover-art"><div className="discover-mini-list"><span><Check size={13}/>Leite</span><span><Check size={13}/>Pão</span><span className="discover-muted-item">○ Fruta</span></div><span className="discover-art-icon"><ShoppingBasket size={22}/></span></div><span className="discover-kicker">{t("NO SUPERMERCADO")}</span><h2>{t("Compra com mais foco.")}</h2><p>{t("Usa o modo supermercado para acompanhar o que já foi comprado e o que falta. É especialmente útil quando várias pessoas fazem compras em simultâneo, porque todos podem acompanhar a mesma lista atualizada.")}</p></article>
          <article className="discover-feature"><div className="discover-art"><div className="discover-repeat-icon"><Repeat2 size={34}/></div><div className="discover-saved-label"><FileText size={15}/>{t("Lista guardada")}</div></div><span className="discover-kicker">{t("ROTINAS MAIS SIMPLES")}</span><h2>{t("Repete compras habituais.")}</h2><p>{t("Guarda listas reutilizáveis e recupera compras frequentes sem ter de começar sempre do zero.")}</p></article>
        </div>
        <section className="discover-ai-note"><div className="discover-ai-note-icon"><Sparkles size={22}/></div><div><h2>{t("Inteligência artificial com confirmação tua.")}</h2><p>{t("A IA ajuda a interpretar imagens e voz, mas pode cometer erros. Revê os resultados antes de os adicionares à lista ou utilizares informação extraída de uma fatura.")}</p></div></section>
        <section className="discover-bottom-cta"><span className="eyebrow"><Leaf size={15}/>{t("MAIS SIMPLES, JUNTOS")}</span><h2>{t("Vamos organizar as compras?")}</h2><p>{t("Cria uma lista e começa a usar a Listora com a tua família.")}</p><button type="button" className="primary-button" onClick={closeDiscover}>{t("Criar a minha lista")}<ArrowRight size={18}/></button></section>
      </section> : <section className="welcome-content">
        <div className="eyebrow"><Leaf size={15}/> {t("MAIS SIMPLES, JUNTOS")}</div>
        <h1>{t("As compras da família.")}<br/><span>{t("Sem esquecimentos.")}</span></h1>
        <p className="welcome-copy">{t("Uma lista partilhada, sempre atualizada. Adiciona o que falta em casa e deixa o resto connosco.")}</p>
        <button type="button" className="welcome-discover-card" onClick={openDiscover}><span className="welcome-discover-icon"><Sparkles size={22}/></span><span className="welcome-discover-copy"><strong>{t("Descobre tudo o que a Listora pode fazer")}</strong><small>{t("Fotografia e voz com IA, listas partilhadas, faturas e muito mais.")}</small></span><ArrowRight size={21} className="welcome-discover-arrow"/></button>
        {initialInviteCode && !inviteDismissed && <section className="invite-confirmation" aria-live="polite"><div className="invite-confirmation-icon"><Users size={22}/></div><div className="invite-confirmation-copy"><span className="invite-eyebrow">{t("CONVITE PARA UMA LISTA")}</span><h2>{inviteLookupBusy ? t("A verificar o convite…") : inviteList ? <>{t("Foste convidado para")} «{inviteList.name}»</> : t("Foste convidado para uma lista partilhada")}</h2><p>{inviteList ? t("Queres entrar nesta lista e partilhar as compras com a família?") : t("O código do convite já está preenchido. Confirma o teu nome para entrar.")}</p>{inviteAccepted && <form className="invite-name-entry" onSubmit={e => { e.preventDefault(); setError(""); void joinList(e); }}><label htmlFor="invite-name">{t("O teu nome")}</label><input id="invite-name" value={memberNameInput} onChange={e => setMemberNameInput(e.target.value)} placeholder={t("Escreve o teu nome")} autoComplete="name" maxLength={60} required/><button type="submit" className="invite-accept-button" disabled={loading || inviteLookupBusy}>{loading ? t("A entrar…") : t("Confirmar e entrar")}</button>{error && <p className="invite-error" role="alert">{error}</p>}</form>}</div><div className="invite-actions">{!inviteAccepted && <><button type="button" className="invite-dismiss-button" onClick={() => { setInviteDismissed(true); setJoinCode(""); setInviteList(null); window.history.replaceState({}, "", window.location.pathname); }}>{t("Não, obrigado")}</button><button type="button" className="invite-accept-button" disabled={inviteLookupBusy} onClick={() => setInviteAccepted(true)}>{t("Entrar na lista")}</button></>}</div></section>}
        <div className={`welcome-card ${initialInviteCode && !inviteDismissed ? "invite-mode" : ""} ${initialInviteCode && !inviteDismissed ? "invite-create-hidden" : ""}`}>
          <div className="card-heading"><span className="card-icon"><Plus size={19}/></span><div><h2>{t("Criar uma lista nova")}</h2><p>{t("Começa uma lista e convida a família.")}</p></div></div>
          <form onSubmit={createList} className={`create-form ${initialInviteCode && !inviteDismissed ? "create-form-secondary" : ""}`}>
            <label htmlFor="member-name">{t("O teu nome")}</label><input id="member-name" value={memberNameInput} onChange={e => setMemberNameInput(e.target.value)} maxLength={60} placeholder={t("Ex.: Guilherme")} required autoComplete="name"/>
            <label htmlFor="list-name">{t("Nome da lista")}</label>
            <input id="list-name" value={listName} onChange={e => setListName(e.target.value)} maxLength={60} placeholder={t("Compras da família")}/>
            <button className="primary-button" disabled={loading} type="submit">{loading ? t("A criar…") : t("Criar lista")} <ArrowRight size={18}/></button>
          </form>
          <div className="form-divider"><span>{t("ou")}</span></div>
          <form onSubmit={joinList} className={`join-form ${initialInviteCode && !inviteDismissed ? "join-form-invited" : ""}`}>
            <label htmlFor="member-name-join">{t("O teu nome")}</label><input id="member-name-join" value={memberNameInput} onChange={e => setMemberNameInput(e.target.value)} maxLength={60} placeholder="Ex.: Guilherme" required autoComplete="name"/>
            <label htmlFor="join-code">{t("Já tens um código de partilha?")}</label>
            <div className="join-row"><input id="join-code" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder={t("Ex.: A3K9PX")} maxLength={12}/><button aria-label={t("Entrar na lista")} type="submit" className="join-button"><ArrowRight size={20}/></button></div>
          </form>
          {error && <p className="error-message">{error}</p>}
        </div>
        <div className="welcome-foot"><Users size={17}/><span>{t("Feita para partilhar. Simples para todos.")}</span></div>
      </section>
      }
      <footer className="welcome-footer"><button type="button" className="discover-footer-link" onClick={shareLandingPage}><Share2 size={13}/>{t("Partilhar a Listora com amigos")}</button>{showDiscover ? <button type="button" className="discover-footer-link" onClick={closeDiscover}>{t("Voltar à página inicial")}</button> : <>{t("A tua casa, mais organizada.")} · <button type="button" className="discover-footer-link" onClick={openDiscover}>{t("Conhecer todas as funcionalidades")}</button></>}</footer>
    </main>
  );

  return (
    <main className="app-shell">
      {!isStandalone && !installDismissed && (installPrompt || /Android|iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) || /Chrome|Chromium|Edg/.test(navigator.userAgent)) && <aside className="install-prompt-banner install-prompt-banner-rich" role="region" aria-label={t("Instalar Listora")}><div className="install-prompt-rich-main"><div className="install-prompt-rich-icon"><ShoppingBasket size={43}/></div><div className="install-prompt-rich-copy"><strong>{t("Instala a Listora")}</strong><span>{t("Acede às tuas listas diretamente no telemóvel, com mais rapidez e funcionalidades.")}</span></div><button type="button" className="install-prompt-action install-prompt-rich-action" onClick={installApp}><Download size={20}/><span>{(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) ? t("Como instalar") : t("Instalar agora")}</span><ArrowRight size={18}/></button><button type="button" className="install-prompt-close install-prompt-rich-close" aria-label={t("Fechar aviso de instalação")} onClick={() => {setInstallDismissed(true); localStorage.setItem("listora-install-dismissed","1");}}><X size={20}/></button></div><div className="install-prompt-benefits"><div><span className="install-benefit-icon install-benefit-speed"><Zap size={21}/></span><span>{t("Mais rápido")}</span></div><div><span className="install-benefit-icon install-benefit-home"><Smartphone size={21}/></span><span>{t("Sempre à mão")}</span></div><div><span className="install-benefit-icon install-benefit-notifications"><Bell size={21}/></span><span>{t("Notificações")}</span></div></div></aside>}
      <header className="topbar refined-topbar">
        <div className="refined-brand">
          <span className="brand-mark"><ShoppingBasket size={24}/></span>
          <div className="refined-brand-copy"><span className="brand-name">Listora</span><button type="button" className="list-name-inline" aria-expanded={showListMenu} onClick={() => setShowListMenu(v => !v)}>{displayListName}<ChevronDown size={15}/></button>{showListMenu && <div className="list-switch-menu"><strong>{t("Lista atual")}</strong><button type="button" onClick={() => {setShowListMenu(false); setShowShare(true);}}><Share2 size={16}/>{t("Partilhar lista")}</button><button type="button" onClick={() => {setShowListMenu(false); leaveCurrentList();}}><LogOut size={16}/>{t("Sair da lista")}</button><button type="button" onClick={() => {setShowListMenu(false); leaveCurrentList();}}><Plus size={16}/>{t("Sair e criar nova lista")}</button></div>}</div>
        </div>
        <div className="topbar-actions">
          <LanguagePicker language={language} onChange={setLanguage} />
          <button className="icon-action" onClick={() => setShowShare(true)} aria-label={t("Partilhar")} title={t("Partilhar")}><Share2 size={22}/></button>
          <button className="icon-action" onClick={() => { if (doneItems.length) repeatItem(doneItems[0].name); else document.querySelector(".add-main input")?.focus(); }} aria-label={t("Repetir compras")} title={t("Repetir compras")}><Repeat2 size={22}/></button>
        </div>
      </header>
      <nav className="main-tabs" aria-label={t("Secções da lista")}>
        <button type="button" className={activeTab === "shopping" ? "main-tab active" : "main-tab"} onClick={() => setActiveTab("shopping")}><ShoppingBasket size={17}/> {t("Lista de compras")}</button>
        <button type="button" className={activeTab === "receipts" ? "main-tab active" : "main-tab"} onClick={() => setActiveTab("receipts")}><Receipt size={17}/> {t("Faturas")} <span>{receipts.length}</span></button>
      </nav>
      {activeTab === "shopping" && <>
      <section className="list-header">
        <div className="list-title-line"><div><div className="eyebrow">{t("A LISTA DA CASA")}</div><h1>{displayListName}</h1></div><span className={`sync-status ${connected ? "online" : ""}`} title={connected ? t("Sincronização ativa") : t("A ligar")}>{connected ? <Wifi size={15}/> : <WifiOff size={15}/>}<span>{connected ? t("Sincronizada") : t("A ligar…")}</span></span></div>
        <div className="progress-line"><div className="progress-track"><span style={{ width: `${items.length ? (doneItems.length / items.length) * 100 : 0}%` }}/></div><span>{doneItems.length} {t("de")} {items.length} {t("comprados")}</span></div>
      </section>
      <section className="add-panel" hidden={shoppingMode}>
        <form onSubmit={addItem}>
          <div className="add-main"><button type="submit" className="input-plus add-submit-left" aria-label={t("Adicionar artigo")} disabled={!name.trim()}><Plus size={22}/></button><input list="item-history-suggestions" value={name} onChange={e => setName(e.target.value)} placeholder={t("Adicionar produto…")} aria-label={t("Nome do artigo")} maxLength={100}/><datalist id="item-history-suggestions">{suggestions.map(itemName => <option key={itemName} value={itemName}/>)}</datalist><div className="add-import-tools add-import-tools-inline" aria-label={t("Adicionar por imagem ou voz")}><div className="add-photo-tool"><button type="button" className="add-tool-button add-tool-photo" aria-label={t("Fotografar lista")} title={t("Fotografa uma lista para reconhecer os produtos")} aria-expanded={showPhotoSource} disabled={importBusy} onClick={() => setShowPhotoSource(v => !v)}><Camera size={19}/></button>{showPhotoSource && <div className="photo-source-menu"><button type="button" onClick={() => {setShowPhotoSource(false); imageCameraInputRef.current?.click();}}><Camera size={18}/><span><strong>{t("Abrir câmara")}</strong><small>{t("Fotografar uma lista de compras em papel, manuscrita ou num quadro.")}</small></span></button><button type="button" onClick={() => {setShowPhotoSource(false); imageFileInputRef.current?.click();}}><Upload size={18}/><span><strong>{t("Escolher da galeria")}</strong><small>{t("Escolher uma fotografia de uma lista de compras.")}</small></span></button></div>}</div><button type="button" className={listening ? "add-tool-button add-tool-voice recording" : "add-tool-button add-tool-voice"} aria-label={listening ? t("A ouvir… toca para parar") : t("Adicionar por voz")} title={t("Dita vários produtos sem escrever")} disabled={importBusy} onClick={startVoiceImport}><Mic size={19}/></button></div></div>
          <div className="quick-add-chips" aria-label={t("Sugestões rápidas")}>{(language === "pt-PT" ? ["Leite","Pão","Água"] : language === "en" ? ["Milk","Bread","Water"] : language === "es" ? ["Leche","Pan","Agua"] : language === "fr" ? ["Lait","Pain","Eau"] : language === "de" ? ["Milch","Brot","Wasser"] : language === "it" ? ["Latte","Pane","Acqua"] : language === "nl" ? ["Melk","Brood","Water"] : language === "pl" ? ["Mleko","Chleb","Woda"] : language === "ro" ? ["Lapte","Pâine","Apă"] : ["牛奶","面包","水"]).map(itemName => <button type="button" key={itemName} onClick={() => submitItem(itemName)}><Plus size={13}/>{itemName}</button>)}<button type="button" className="quick-add-other" onClick={() => {setShowOtherProducts(v => !v); setOtherProductSearch("");}}><Plus size={13}/>{t("Outros")}</button></div>
          
          {showOtherProducts && <section className="other-products-panel"><div className="other-products-heading"><div><strong>{t("Escolhe outros produtos")}</strong><small>{t("Toca num produto para o adicionar à lista.")}</small></div><button type="button" aria-label={t("Fechar")} onClick={() => setShowOtherProducts(false)}><X size={18}/></button></div><input className="other-products-search" value={otherProductSearch} onChange={e => setOtherProductSearch(e.target.value)} placeholder={t("Pesquisar produtos…")}/>{(language === "pt-PT" ? [{category:"Carne e peixe",items:["Ovos","Frango","Carne picada","Bifes","Costeletas","Salsichas","Fiambre","Bacon","Peixe","Salmão","Atum","Camarão"]},{category:"Pequeno-almoço e cereais",items:["Cereais","Muesli","Aveia","Granola","Iogurtes","Queijo","Manteiga","Margarina","Compota","Mel"]},{category:"Fruta e legumes",items:["Maçãs","Bananas","Laranjas","Tomates","Batatas","Cebolas","Alface","Cenouras","Brócolos","Abacates"]},{category:"Despensa",items:["Arroz","Massa","Farinha","Açúcar","Sal","Azeite","Óleo","Feijão","Grão","Lentilhas","Tomate em lata","Caldo"]},{category:"Congelados",items:["Legumes congelados","Pizza","Gelado","Batatas fritas congeladas"]},{category:"Casa e higiene",items:["Detergente da roupa","Detergente da loiça","Papel higiénico","Papel de cozinha","Champô","Pasta de dentes"]}] : language === "en" ? [{category:"Meat and fish",items:["Eggs","Chicken","Minced beef","Steak","Pork chops","Sausages","Ham","Bacon","Fish","Salmon","Tuna","Prawns"]},{category:"Breakfast and cereals",items:["Cereal","Muesli","Oats","Granola","Yogurt","Cheese","Butter","Margarine","Jam","Honey"]},{category:"Fruit and vegetables",items:["Apples","Bananas","Oranges","Tomatoes","Potatoes","Onions","Lettuce","Carrots","Broccoli","Avocados"]},{category:"Pantry",items:["Rice","Pasta","Flour","Sugar","Salt","Olive oil","Cooking oil","Beans","Chickpeas","Lentils","Canned tomatoes","Stock cubes"]},{category:"Frozen",items:["Frozen vegetables","Pizza","Ice cream","Frozen chips"]},{category:"Home and personal care",items:["Laundry detergent","Dish soap","Toilet paper","Kitchen roll","Shampoo","Toothpaste"]}] : [{category:t("Carne e peixe"),items:[t("Ovos"),t("Frango"),t("Carne picada"),t("Bifes"),t("Costeletas"),t("Salsichas"),t("Fiambre"),t("Bacon"),t("Peixe"),t("Salmão"),t("Atum"),t("Camarão")]},{category:t("Pequeno-almoço e cereais"),items:[t("Cereais"),t("Muesli"),t("Aveia"),t("Granola"),t("Iogurtes"),t("Queijo"),t("Manteiga"),t("Margarina"),t("Compota"),t("Mel")]},{category:t("Fruta e legumes"),items:[t("Maçãs"),t("Bananas"),t("Laranjas"),t("Tomates"),t("Batatas"),t("Cebolas"),t("Alface"),t("Cenouras"),t("Brócolos"),t("Abacates")]},{category:t("Despensa"),items:[t("Arroz"),t("Massa"),t("Farinha"),t("Açúcar"),t("Sal"),t("Azeite"),t("Óleo"),t("Feijão"),t("Grão"),t("Lentilhas"),t("Tomate em lata"),t("Caldo")]},{category:t("Congelados"),items:[t("Legumes congelados"),t("Pizza"),t("Gelado"),t("Batatas fritas congeladas")]},{category:t("Casa e higiene"),items:[t("Detergente da roupa"),t("Detergente da loiça"),t("Papel higiénico"),t("Papel de cozinha"),t("Champô"),t("Pasta de dentes")]}]).map(group => ({...group, items:group.items.filter(item => item.toLocaleLowerCase().includes(otherProductSearch.toLocaleLowerCase()))})).filter(group => group.items.length > 0).map(group => <div className="other-products-group" key={group.category}><strong>{group.category}</strong><div>{group.items.map(item => <button type="button" key={item} onClick={async () => {const added=await submitItem(item); if(added) setShowOtherProducts(false);}}><Plus size={13}/>{item}</button>)}</div></div>)}</section>}
          <input ref={imageFileInputRef} type="file" accept="image/*" hidden onChange={e => { void processPhoto(e.target.files?.[0]); e.target.value = ""; }}/>
          <input ref={imageCameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { void processPhoto(e.target.files?.[0]); e.target.value = ""; }}/>{(importBusy || importError) && <div className={importError ? "ai-import-status error-message" : "ai-import-status"}>{importBusy && <LoaderCircle size={15} className="spin"/>}{importBusy ? (importSource === "photo" ? "A analisar a fotografia…" : "A interpretar os produtos…") : importError}</div>}
          <div className="add-options"><div className="quantity-control"><label htmlFor="quantity">{t("Qtd.")}</label><input id="quantity" type="number" min="1" max="999" value={quantity} onChange={e => setQuantity(e.target.value)}/></div><span className="option-separator"/><label className="category-select-label" htmlFor="category-select">{t("Categoria")}</label><select id="category-select" value={category} onChange={e => setCategory(e.target.value)}><option value="auto">{t("Automática")}</option>{CATEGORIES.filter(c => c.id !== "all").map(c => <option key={c.id} value={c.id}>{c.emoji} {t(c.label)}</option>)}</select></div>
        </form>
      </section>
      <nav className="quick-actions" hidden={shoppingMode} aria-label={t("Ações rápidas")}>
        <button type="button" className="quick-action" onClick={() => doneItems.length ? repeatItem(doneItems[0].name) : document.querySelector(".add-main input")?.focus()}><span className="quick-action-icon">↻</span>{t("Repetir compras")}</button>
        <button type="button" className="quick-action" onClick={() => { setShoppingMode(false); document.querySelector(".templates-section")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><span className="quick-action-icon"><span className="folder-glyph">▱</span></span>{t("Listas guardadas")}</button>
      </nav>
      <section className={templates.length ? "templates-section" : "templates-section is-empty"} hidden={shoppingMode}>
        <div className="templates-title-row"><span>{t("Listas reutilizáveis")}</span><button type="button" onClick={saveCurrentTemplate} disabled={!activeItems.length}>{t("Guardar lista atual")}</button></div>
        {templates.length > 0 ? <div className="template-chips">{templates.map(template => <button type="button" className="template-chip" key={template.id} onClick={() => useTemplate(template)}><span>{template.name}</span><small>{template.items.length} {t("artigos")}</small></button>)}</div> : <p className="template-hint">{t("Guarda uma compra habitual para a reutilizares noutra semana.")}</p>}
      </section>
      {doneItems.length > 0 && !shoppingMode && <section className="repeat-section" aria-label={t("Repetir compras")}>
        <div className="repeat-heading">{t("Repetir compras")}</div>
        <div className="repeat-chips">{[...new Map(doneItems.map(item => [item.name.toLocaleLowerCase(), item.name])).values()].slice(0, 5).map(itemName => <button type="button" className="repeat-chip" key={itemName} onClick={() => repeatItem(itemName)}><Plus size={13}/>{itemName}</button>)}</div>
      </section>}
      {!showOnboarding && !shoppingMode && activeTab === "shopping" && activeItems.length > 0 && showShoppingNudge && !itemsSectionVisible && <button type="button" className="shopping-list-floating-nudge" onClick={() => document.querySelector(".items-section")?.scrollIntoView({behavior:"smooth",block:"start"})}><span className="shopping-nudge-icon"><ShoppingBasket size={25}/></span><span className="shopping-nudge-copy"><strong>{items.length} {t("produtos na lista")}</strong><small>{t("Desliza para ver")}</small></span><span className="shopping-nudge-divider"/><span className="shopping-nudge-chevron"><ChevronDown size={24}/><ChevronDown size={24}/></span><span className="shopping-nudge-close" aria-label={t("Fechar aviso")} onClick={e => {e.stopPropagation();setShowShoppingNudge(false);}}><X size={17}/></span></button>}
      <div className={shoppingMode ? "shopping-mode-row active" : "shopping-mode-row"}>
        <span className="shopping-mode-copy"><ShoppingBasket size={24} strokeWidth={2.2}/><span className="shopping-mode-text"><strong>{t("Modo supermercado")}</strong><small>{t("Lista otimizada para comprar na loja")}</small></span></span>
        <button type="button" className={shoppingMode ? "mode-toggle active" : "mode-toggle"} aria-pressed={shoppingMode} onClick={() => { setShoppingMode(!shoppingMode); setShowDone(false); }}>{shoppingMode ? "Sair" : t("Ativar")}</button>
      </div>
      {shoppingMode && <section className="supermarket-summary" aria-label="Progresso das compras">
        <div className="supermarket-summary-top"><div><span className="supermarket-kicker">{t("AS TUAS COMPRAS")}</span><h2>{doneItems.length === items.length && items.length > 0 ? t("Tudo comprado!") : t("Vamos às compras")}</h2></div><strong>{doneItems.length}<span> / {items.length}</span></strong></div>
        <div className="supermarket-progress-track"><span style={{width: `${shoppingProgress}%`}}/></div>
        <div className="supermarket-summary-bottom"><span>{t("Progresso das compras", { done: doneItems.length, total: items.length })}</span><button type="button" className={showDone ? "purchased-filter active" : "purchased-filter"} onClick={() => setShowDone(!showDone)}>{showDone ? "Ver por comprar" : `Comprados (${doneItems.length})`}</button></div>
      </section>}
      <nav className="category-tabs" aria-label={t("Filtrar por categoria")} tabIndex={0}>
        {CATEGORIES.map(c => <button key={c.id} className={filter === c.id ? "category-tab active" : "category-tab"} onClick={() => setFilter(c.id)}><span>{c.emoji}</span>{t(c.label)}{c.id === "all" && <span className="tab-count">{activeItems.length}</span>}</button>)}
      </nav>
      <section className={shoppingMode ? "items-section supermarket-items-section" : "items-section"}>
        <div className="section-heading"><div><h2>{shoppingMode ? (showDone ? t("Comprados") : t("Por comprar")) : showDone ? t("Já comprados") : t("Falta comprar")}</h2><span>{visibleItems.length} {visibleItems.length === 1 ? t("artigo") : t("artigos")}</span></div>{!shoppingMode && <button className="view-toggle" onClick={() => setShowDone(!showDone)}>{showDone ? t("Ver por comprar") : `${t("Ver comprados")} (${doneItems.length})`} <ChevronDown size={15} className={showDone ? "rotate" : ""}/></button>}</div>
        {visibleItems.length === 0 ? <div className="empty-state"><span className="empty-illustration">{showDone ? "✨" : "🧺"}</span><h3>{showDone ? t("Ainda não há compras concluídas") : filter === "all" ? t("A lista está vazia") : t("Nada nesta categoria")}</h3><p>{showDone ? t("Quando marcares um artigo como comprado, aparece aqui.") : t("Adiciona o primeiro artigo no campo acima.")}</p></div> : (
          <div className={shoppingMode ? "items-list supermarket-list" : "items-list"}>{(shoppingMode && filter === "all" ? [...visibleItems].sort((a, b) => CATEGORIES.findIndex(cat => cat.id === a.category) - CATEGORIES.findIndex(cat => cat.id === b.category)) : visibleItems).map(item => {
            const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[5];
            return <article className={`shopping-item ${item.done ? "is-done" : ""}`} key={item._id}>
              <button className={`check-button ${item.done ? "checked" : ""}`} onClick={() => updateItem(item, { done: !item.done })} aria-label={item.done ? t("Marcar como por comprar") : t("Marcar como comprado")}>{item.done && <Check size={17}/>}</button>
              <div className="item-copy"><span className="item-name">{item.name}</span><span className="item-meta"><span>{cat.emoji} {t(cat.label)}</span><span className="meta-dot">·</span><span>{t("Qtd.")} {item.quantity}</span></span></div>
              <button className="delete-button" onClick={() => deleteItem(item)} aria-label={`${t("Remover")} ${item.name}`}><Trash2 size={17}/></button>
            </article>;
          })}</div>
        )}
        {doneItems.length > 0 && !showDone && !shoppingMode && <button className="clear-done" onClick={clearDone}><CheckCheck size={16}/> {t("Limpar artigos comprados")}</button>}
        {items.length > 0 && !shoppingMode && <button type="button" className="clear-all-items" onClick={clearAllItems}><Trash2 size={16}/> {t("Remover todos os produtos")}</button>}
      </section>
      {!shoppingMode && <div className="purchased-dock">
        <button type="button" className={showDone ? "purchased-dock-button active" : "purchased-dock-button"} onClick={() => { setShowDone(!showDone); document.querySelector(".items-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
          <span>{showDone ? t("Ver por comprar") : t("Ver comprados")} ({doneItems.length})</span><ChevronDown size={19} className={showDone ? "dock-chevron rotated" : "dock-chevron"}/>
        </button>
      </div>}
      </>}
      {activeTab === "receipts" && <section className="receipts-section">
        <div className="receipts-heading"><div><span className="eyebrow">{t("ARQUIVO PARTILHADO")}</span><h1>{t("Faturas de compras")}</h1><p>{t("Comprovativos acessíveis a todos os membros desta lista.")}</p></div></div>
        <form className="receipt-form" onSubmit={addReceipt}>
          <h2><Upload size={18}/> {t("Adicionar fatura")}</h2>
          {receiptNeedsName && !memberName.trim() && <div className="receipt-name-prompt"><strong>{t("Antes de guardar, como te devemos identificar?")}</strong><label htmlFor="receipt-member-name">{t("O teu nome")}</label><input id="receipt-member-name" value={memberNameInput} onChange={e => setMemberNameInput(e.target.value)} placeholder={t("Ex.: Ana")} maxLength={60} autoComplete="name" required/><small>{t("O nome ficará associado às faturas que adicionares nesta lista.")}</small><button type="button" className="secondary-button" disabled={!memberNameInput.trim()} onClick={() => { const displayName = memberNameInput.trim().slice(0,60); localStorage.setItem("listora-member-name", displayName); setMemberName(displayName); setReceiptNeedsName(false); setError(""); }}>{t("Guardar nome e continuar")}</button></div>}
          <label htmlFor="receipt-store">{t("Supermercado")}</label><input id="receipt-store" value={receiptStore} onChange={e => setReceiptStore(e.target.value)} placeholder={t("Ex.: Continente, Lidl, Pingo Doce")} maxLength={120} required/>
          <div className="receipt-form-grid"><div><label htmlFor="receipt-date">{t("Data da compra")}</label><input id="receipt-date" type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} required/></div><div><label htmlFor="receipt-total">{t("Total (€)")}</label><input id="receipt-total" type="number" min="0" step="0.01" value={receiptTotal} onChange={e => setReceiptTotal(e.target.value)} placeholder="0,00" required/></div></div>
          <label htmlFor="receipt-notes">{t("Notas (opcional)")}</label><textarea id="receipt-notes" value={receiptNotes} onChange={e => setReceiptNotes(e.target.value)} maxLength={1000} placeholder={t("Ex.: compras da semana, IVA, descontos…")}/>
          <label className={`receipt-file-label ${receiptExtractBusy ? "receipt-file-analyzing" : ""} ${receiptFile ? "receipt-file-selected" : ""}`} htmlFor="receipt-file"><span className="receipt-upload-icon">{receiptExtractBusy ? <LoaderCircle size={22} className="spin"/> : <FileText size={22}/>}</span><span className="receipt-upload-copy"><strong>{receiptFile ? receiptFile.name : t("Tirar fotografia ou anexar ficheiro")}</strong><small>{receiptFile ? t("Ficheiro selecionado") : t("Fotografia ou PDF · até 10 MB")}</small></span><span className="receipt-upload-action">{receiptExtractBusy ? t("A analisar…") : t("Carregar ficheiro")}</span></label><input className="receipt-file-input" id="receipt-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => { const file = e.target.files?.[0] || null; setReceiptFile(file); setReceiptExtraction(null); if (file) void extractReceiptData(file); }}/>
          {receiptExtractBusy && <div className="receipt-analysis-overlay" role="status" aria-live="polite"><div className="receipt-analysis-modal"><LoaderCircle size={36} className="spin"/><strong>{t("A analisar a fatura com IA…")}</strong><span>{t("A identificar o supermercado, a data, o total, o IVA e os artigos. Isto pode demorar alguns segundos.")}</span><small>{t("Não feches esta página. Vamos preencher os campos automaticamente para confirmares antes de guardar.")}</small></div></div>}
          <p className="receipt-ai-hint">{t("A IA tenta identificar o supermercado, a data, o total, o IVA e os artigos. Revê sempre as sugestões antes de guardar.")}</p>
          {receiptExtraction && <div className="receipt-extraction-preview" role="status">
            <strong><Check size={16}/> {t("Sugestões extraídas — confirma os campos acima")}</strong>
            {receiptExtraction.vatTotal !== null && receiptExtraction.vatTotal !== undefined && <span>{t("IVA identificado")}: €{Number(receiptExtraction.vatTotal).toFixed(2)}</span>}
            {receiptExtraction.items.length > 0 && <div><span>{t("Artigos identificados")} ({receiptExtraction.items.length})</span><ul>{receiptExtraction.items.slice(0,12).map((item,index) => <li key={index}>{item.name}{Number.isFinite(Number(item.total)) ? " — €"+Number(item.total).toFixed(2) : ""}</li>)}</ul>{receiptExtraction.items.length > 12 && <small>{t("Mais artigos incluídos nas notas", { count: receiptExtraction.items.length - 12 })}</small>}</div>}
            {receiptExtraction.warnings.map((warning,index) => <small key={index}>{warning}</small>)}
          </div>}
          <button className="primary-button" type="submit" disabled={receiptBusy}>{receiptBusy ? <LoaderCircle size={17} className="spin"/> : <Plus size={17}/>} {t("Guardar fatura")}</button>
        </form>
        <div className="receipt-list-heading"><h2>{t("Faturas partilhadas")}</h2><span>{receipts.length} {receipts.length === 1 ? t("fatura") : t("faturas")}</span></div>
        {receipts.length === 0 ? <div className="empty-state"><span className="empty-illustration">🧾</span><h3>{t("Ainda não há faturas")}</h3><p>{t("Adiciona o primeiro comprovativo para ficar disponível a toda a família.")}</p></div> : <div className="receipt-list">{receipts.map(receipt => <article className="receipt-card" key={receipt.id}><div className="receipt-card-icon"><Receipt size={21}/></div><div className="receipt-card-main"><strong>{receipt.storeName}</strong><span>{new Date(receipt.purchasedAt + "T12:00:00").toLocaleDateString(language === "en" ? "en-GB" : language)} · {receipt.memberName || t("Membro")}</span>{receipt.notes && <p>{receipt.notes}</p>}</div><div className="receipt-card-side"><strong>{Number(receipt.total).toLocaleString(language === "en" ? "en-GB" : language,{style:"currency",currency:"EUR"})}</strong>{receipt.filePath && <button type="button" onClick={() => openReceipt(receipt)} aria-label={t("Abrir comprovativo")}><ExternalLink size={17}/></button>}<button type="button" onClick={() => removeReceipt(receipt)} aria-label={t("Apagar fatura")}><Trash2 size={16}/></button></div></article>)}</div>}
      </section>}
      <footer className="app-footer"><span><Leaf size={15}/> {t("Menos esquecimentos, mais tempo juntos.")}</span><button onClick={leaveCurrentList}>{t("Sair da lista")} / {t("Criar nova")}</button></footer>
      {voiceModalOpen && (listening || (importBusy && importSource === "voice")) && <div className="modal-backdrop voice-modal-backdrop" onClick={() => { recognitionRef.current?.stop(); setListening(false); setVoiceModalOpen(false); }}>
        <section className="share-modal voice-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="voice-modal-title">
          <button type="button" className="modal-close" aria-label={t("Fechar")} onClick={() => { recognitionRef.current?.stop(); setListening(false); setVoiceModalOpen(false); }}><X size={20}/></button>
          <div className="voice-status-row"><div className={"voice-modal-icon " + (importBusy ? "is-processing" : "is-listening")}>{importBusy ? <LoaderCircle className="spin" size={26}/> : <Mic size={26}/>}</div>
          <span className={"voice-status-pill " + (listening ? "active" : "processing")}><span className="voice-status-dot"/>{importBusy ? t("A processar voz…") : listening ? t("Microfone ativo") : t("A preparar microfone…")}</span></div>
          <h2 id="voice-modal-title">{importBusy ? t("A identificar os produtos") : listening ? t("Podes começar a falar") : t("A preparar microfone…")}</h2>
          <p>{importBusy ? t("Estamos a identificar os produtos que disseste. Só mais um momento.") : t("Diz vários produtos seguidos. Não precisas de fazer pausas entre cada produto.")}</p>
          {!importBusy && <div className="voice-example"><span>{t("Por exemplo")}</span><strong>“{t("Leite, pão, seis ovos e dois iogurtes.")}”</strong></div>}
          {listening && <div className="voice-wave"><span/><span/><span/><span/><span/><span/><span/><span/><span/></div>}
          {importBusy && <div className="voice-processing-note"><LoaderCircle className="spin" size={16}/>{t("A analisar o que disseste…")}</div>}
          {listening && <button type="button" className="primary-button voice-stop-button" onClick={() => { recognitionRef.current?.stop(); setListening(false); setVoiceModalOpen(false); }}><X size={17}/>{t("Parar gravação")}</button>}
        </section>
      </div>}
      {importPreview.length > 0 && <div className="modal-backdrop" onClick={() => !importBusy && setImportPreview([])}><section className="share-modal import-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="import-title"><button className="modal-close" onClick={() => !importBusy && setImportPreview([])} aria-label={t("Fechar")}><X size={20}/></button><div className="share-graphic"><ShoppingBasket size={28}/></div><h2 id="import-title">{t("Confirmar produtos")}</h2><p>{importSource === "photo" ? "Revê os produtos reconhecidos na fotografia." : "Revê os produtos reconhecidos por voz."} Podes corrigir os nomes e quantidades antes de adicionar.</p><div className="import-preview-list">{importPreview.map((item, index) => <div className="import-preview-row" key={index}><input aria-label={`Produto ${index + 1}`} value={item.name} maxLength={100} onChange={e => editPreviewItem(index, { name: e.target.value })}/><input aria-label={`Quantidade de ${item.name}`} type="number" min="1" max="999" value={item.quantity} onChange={e => editPreviewItem(index, { quantity: e.target.value })}/><button type="button" aria-label={`Remover ${item.name}`} onClick={() => setImportPreview(previous => previous.filter((_, i) => i !== index))}><X size={17}/></button></div>)}</div>{importError && <p className="error-message">{importError}</p>}<button className="primary-button" disabled={importBusy || !importPreview.some(item => item.name.trim())} onClick={confirmImport}>{importBusy ? <LoaderCircle className="spin" size={17}/> : <Check size={17}/>} {importBusy ? "A adicionar…" : `Adicionar ${importPreview.length} produtos`}</button><button className="secondary-button" disabled={importBusy} onClick={() => setImportPreview([])}>{t("Cancelar")}</button></section></div>}
      {showOnboarding && <div className="modal-backdrop onboarding-backdrop" onClick={() => { setShowOnboarding(false); localStorage.setItem("listora-onboarding-v3-complete", "1"); }}>
        <section className="share-modal onboarding-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
          <button type="button" className="modal-close" onClick={() => { setShowOnboarding(false); localStorage.setItem("listora-onboarding-v3-complete", "1"); }} aria-label={t("Fechar introdução")}><X size={20}/></button>
          <div className="onboarding-progress" aria-label={t("Passo")}><span style={{width: `${((onboardingStep + 1) / 6) * 100}%`}}/></div>
          <div className={`onboarding-art onboarding-art-step-${onboardingStep}`} aria-hidden="true">
            {onboardingStep === 0 && <div className="art-shared-list">
              <div className="art-list-top"><span className="art-mini-basket"><ShoppingBasket size={18}/></span><span><strong>Compras da família</strong><small>Sincronizada agora</small></span><span className="art-sync-dot">✓</span></div>
              <div className="art-product-row"><span className="art-product-emoji">🥛</span><span>Leite</span><span className="art-check">✓</span></div>
              <div className="art-product-row"><span className="art-product-emoji">🍞</span><span>Pão</span><span className="art-check">✓</span></div>
              <div className="art-product-row art-row-muted"><span className="art-product-emoji">🍌</span><span>Bananas</span><span className="art-check">✓</span></div>
              <div className="art-member-bubbles"><span>G</span><span>M</span><span>+</span><small>Lista partilhada</small></div>
            </div>}
            {onboardingStep === 1 && <div className="art-add-products">
              <div className="art-input-mock"><span>O que falta em casa?</span><span className="art-add-circle"><Plus size={18}/></span></div>
              <div className="art-quick-chips"><span>＋ Leite</span><span>＋ Pão</span><span>＋ Água</span></div>
              <div className="art-added-product"><span>🥑</span><strong>Abacates</strong><span className="art-add-circle"><Check size={15}/></span></div>
              <div className="art-added-product"><span>🧀</span><strong>Queijo</strong><span className="art-add-circle"><Check size={15}/></span></div>
            </div>}
            {onboardingStep === 2 && <div className="art-capture art-photo-capture">
              <div className="art-paper-list"><strong>Lista de compras</strong>{["Leite","Pão","Ovos","Bananas","Fraldas"].map(product => <span key={product}><i/> {product}</span>)}</div>
              <div className="art-scan-arrow">➜</div>
              <div className="art-phone-list"><div className="art-phone-camera"><Camera size={20}/></div><strong>IA reconhece os produtos</strong>{["Leite","Pão","Ovos","Bananas"].map(product => <span key={product}><i>✓</i>{product}</span>)}<small>Revê antes de adicionar</small></div>
              
            </div>}
            {onboardingStep === 3 && <div className="art-voice-capture">
              <div className="art-voice-mic"><Mic size={36}/></div>
              <strong>Reconhecimento por inteligência artificial</strong>
              <div className="art-voice-wave"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
              <div className="art-voice-pill"><Mic size={15}/><span>“Leite, pão e ovos”</span></div>
              <small>Diz vários produtos numa só frase</small>
            </div>}
            {onboardingStep === 4 && <div className="art-sharing">
              <div className="art-avatar-stack"><span>G</span><span>M</span><span>A</span><span>+</span></div>
              <strong>A lista é melhor em família</strong><small>Todos podem atualizar a mesma lista</small>
              <div className="art-invite-link"><span><Users size={17}/></span><span><b>Convite para a lista</b><small>listora.app/join/••••</small></span><Check size={18}/></div>
              <div className="art-live-update"><span className="art-live-dot"/> Madalena adicionou iogurtes <span>agora</span></div>
            </div>}
            {onboardingStep === 5 && <div className="art-receipts">
              <div className="art-receipt-paper"><div className="art-receipt-brand"><ShoppingBasket size={17}/><strong>SUPERMERCADO</strong></div><span>Fatura de compra</span><b>Leite · Pão · Fruta</b><div className="art-receipt-lines"/><strong className="art-receipt-total">TOTAL&nbsp; 24,80 €</strong><div className="art-receipt-scan"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div></div>
              <div className="art-receipt-badge"><Camera size={17}/><span><strong>Faturas guardadas</strong><small>Fotografa e consulta mais tarde</small></span><Check size={17}/></div>
            </div>}
          </div>
          <span className="onboarding-step-label">{t("DESCOBRE A LISTORA")} · {onboardingStep + 1}/6</span>
          <h2 id="onboarding-title">{t([
            "A tua lista está pronta!",
            "Adiciona o que falta em casa",
            "Importa uma lista com uma fotografia",
            "Diz vários produtos por voz",
            "Partilha com a família",
            "Guarda as faturas das compras"
          ][onboardingStep])}</h2>
          <p className="onboarding-description">{t([
            "Tudo o que precisas para organizar as compras, num só lugar e sempre sincronizado com a tua família.",
            "Escreve o nome de um produto ou usa as sugestões rápidas. Marca cada artigo quando o colocares no carrinho.",
            "Tira uma fotografia a uma lista de compras manuscrita, escrita num papel ou num quadro. A inteligência artificial analisa a imagem, identifica os produtos e prepara uma lista para reveres antes de adicionar.",
            "Diz vários produtos de seguida, como leite, pão e seis ovos. A inteligência artificial interpreta a voz e transforma o que dizes em produtos para confirmares antes de adicionar.",
            "Abre Partilhar para convidares outras pessoas. Todos podem consultar e atualizar a mesma lista.",
            "Fotografa as faturas das tuas compras para as guardar na Listora e consultá-las mais tarde. Também podes repetir compras e guardar listas habituais."
          ][onboardingStep])}</p>
          <div className="onboarding-dots" aria-label={t("Progresso da introdução")}>{[0,1,2,3,4,5].map(step => <span key={step} className={step === onboardingStep ? "active" : ""}/>)}</div>
          {onboardingStep > 0 && <button type="button" className="onboarding-previous" onClick={() => setOnboardingStep(step => step - 1)}>← {t("Anterior")}</button>}
          <button type="button" className="primary-button onboarding-next" onClick={() => {
            if (onboardingStep < 5) { setOnboardingStep(step => step + 1); return; }
            setShowOnboarding(false);
            localStorage.setItem("listora-onboarding-v3-complete", "1");
          }}>{onboardingStep === 5 ? t("Começar a usar a Listora") : t("Continuar")} <ArrowRight size={18}/></button>
          <button type="button" className="onboarding-skip" onClick={() => { setShowOnboarding(false); localStorage.setItem("listora-onboarding-v3-complete", "1"); }}>{t("Saltar introdução")}</button>
        </section>
      </div>}
      {showInstallHelp && <div className="modal-backdrop install-help-backdrop" onClick={() => setShowInstallHelp(false)}><section className="share-modal install-help-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="install-help-title"><button className="modal-close" onClick={() => setShowInstallHelp(false)} aria-label={t("Fechar")}><X size={20}/></button><div className="share-graphic"><Download size={25}/></div><h2 id="install-help-title">{t("Instalar a Listora no iPhone")}</h2>{installHelpNeedsSafari && <p className="install-help-safari-note">{t("Para instalar a Listora, abre primeiro este endereço no Safari.")}</p>}{installHelpNeedsSafari ? <p>{t("A instalação é feita pelo menu Partilhar do Safari. Demora apenas alguns segundos.")}</p> : <p>{t("No Chrome para computador, abre o menu ⋮ e procura a opção Instalar Listora. Se não aparecer, o Chrome pode ainda não considerar o site elegível para instalação.")}</p>}<ol className="install-help-steps"><li><span className="install-help-step-icon"><Share2 size={17}/></span><span><strong>{t("1. Toca em Partilhar")}</strong><small>{t("Na barra do Safari, em baixo ou no topo.")}</small></span></li><li><span className="install-help-step-icon"><Plus size={17}/></span><span><strong>{t("2. Adicionar ao ecrã principal")}</strong><small>{t("Se não aparecer, procura em Editar ações.")}</small></span></li><li><span className="install-help-step-icon"><Check size={17}/></span><span><strong>{t("3. Confirma em Adicionar")}</strong><small>{t("O ícone da Listora ficará no ecrã inicial.")}</small></span></li></ol><button className="primary-button" onClick={() => setShowInstallHelp(false)}>{t("Percebi")}</button></section></div>}
      {showShare && <div className="modal-backdrop" onClick={() => setShowShare(false)}><section className="share-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="share-title"><button className="modal-close" onClick={() => setShowShare(false)} aria-label={t("Fechar")}><X size={20}/></button><div className="share-graphic"><Users size={28}/></div><h2 id="share-title">{t("A lista é melhor em família")}</h2><p>{t("Mostra este QR Code a quem queres convidar. Ao digitalizar, o convite abre a Listora com esta lista pronta a entrar.")}</p><div className="invite-qr"><QRCodeSVG value={inviteUrl} size={208} level="H" includeMargin/><span>{t("Digitaliza com a câmara para entrar na lista")}</span></div><button className="primary-button" onClick={copyInviteLink}><Copy size={17}/> Copiar link de convite</button><div className="share-code-box"><span>{t("CÓDIGO DA LISTA")}</span><strong>{list.shareCode}</strong></div><button className="primary-button" onClick={shareListCode}>{typeof navigator.share === "function" ? <Users size={17}/> : <Copy size={17}/>} {t(typeof navigator.share === "function" ? "Partilhar código" : "Copiar código")}</button>{typeof navigator.share === "function" && <button className="secondary-button" onClick={copyListCode}><Clipboard size={17}/> {t("Copiar apenas o código")}</button>}<p className="share-note"><CircleHelp size={14}/> {t("Qualquer pessoa com o código pode aceder à lista. Partilha apenas com pessoas de confiança.")}</p></section></div>}
      {toast && <div className="toast"><Check size={16}/>{toast}</div>}
      {error && <button className="error-toast" onClick={() => setError("")}>{error}<X size={15}/></button>}
    </main>
  );
}