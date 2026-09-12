// The public catalog is now driven by D1 imports. Placeholder/demo records were removed.
window.BOTS = [];

// The page has a tiny inline mobile animation guard that historically reused
// the same id as the full runtime mobile audit stylesheet. Rename only that
// inline guard before uiux-audit-patch.js runs so the real audit styles can
// install normally.
(()=>{
  const guard=document.getElementById('archiveMobileAuditStyles');
  if(guard && /\.grid\s+\.card/.test(guard.textContent||'')){
    guard.id='archiveMobileAnimationGuard';
  }
})();
