(()=>{
  // Other modules (e.g. character-import.js) may ask the catalog to open a record without holding openModal.
  // The record card itself (files, author link, lorebook) is rendered by app.js renderModalHead.
  window.addEventListener('archive:open-character',e=>{const bot=e.detail?.bot;if(bot&&typeof window.openModal==='function')window.openModal(bot)});
})();
