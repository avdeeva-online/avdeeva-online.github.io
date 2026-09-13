(()=>{
  const tabs=document.querySelector('.tabs');
  if(!tabs||tabs.querySelector('[data-admin-home]'))return;
  const a=document.createElement('a');
  a.href='/admin/';
  a.dataset.adminHome='1';
  a.className='btn';
  a.textContent='← BACK';
  a.setAttribute('aria-label','Back to admin home');
  tabs.prepend(a);
})();
