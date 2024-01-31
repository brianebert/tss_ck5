  // saves content immediately if user declines to leave page
function beforeUnloadListener(e){
    e.preventDefault();
    e.returnValue = '';
    const editor = window.watchdog.editor;
    const pendingActions = editor.plugins.get( 'PendingActions' );
    if(Array.from(pendingActions).filter(el => el.message === 'Saving changes').length)
      return editor.plugins.get('Autosave').save(editor)      
  }

  // Update the "Status: Saving..." information.
function displayStatus( editor ) {
    const toolbarElement = editor.ui.view.toolbar.element;
    const pendingActions = editor.plugins.get( 'PendingActions' );

    editor.on( 'change:isReadOnly', ( evt, propertyName, isReadOnly ) => {
      if ( isReadOnly ) {
        toolbarElement.style.display = 'none';
      } else {
        toolbarElement.style.display = 'flex';
      }
    });
    pendingActions.on( 'change:hasAny', ( evt, propertyName, newValue ) => {
      if ( newValue ) {
        console.log(`detected editor content change at: ${new Date()}`);
        window.addEventListener('beforeunload', beforeUnloadListener, {capture: true});
        statusEl.style.background = '#ffcccc'; // a light pink
      } else {
        window.removeEventListener('beforeunload', beforeUnloadListener, {capture: true});      
        statusEl.style.background = '#ccffcc'; // a light green
      }
    });
    return editor
  }


// creates an editor with a CK watchdog wrapped around it.
// Calls a beforeUnload listener to prevent loss of data
export function CK_Editor(editorEl, statusEl){
  function handleEditorError( error ) { // from ckeditor demo
    console.error( 'Oops, something went wrong!' );
    console.error( 'Please, report the following error on https://github.com/ckeditor/ckeditor5/issues with the build id and the error stack trace:' );
    console.warn( 'Build id: 5idtv2qgr0lp-96kg0aobkl70' );
    console.error( error );
  };

  return window.CKSource.Editor.create(editorEl, {licenseKey: '', width: '80%'})
               .then((editor) => displayStatus(editor, statusEl))
               .catch( handleEditorError )   
}