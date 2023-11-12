// creates an editor with a CK watchdog wrapped around it.
// Calls a beforeUnload listener to prevent loss of data
export class CK_Watchdog {
  constructor(el, setEditorState, saveButton){
    function handleEditorError( error ) { // from ckeditor demo
      console.error( 'Oops, something went wrong!' );
      console.error( 'Please, report the following error on https://github.com/ckeditor/ckeditor5/issues with the build id and the error stack trace:' );
      console.warn( 'Build id: 5idtv2qgr0lp-96kg0aobkl70' );
      console.error( error );
    };

    // This block came from CKSource nearly verbatim
    const wd = new window.CKSource.EditorWatchdog();
    wd.setCreator( ( element, config ) => 
      window.CKSource.Editor.create( element, config )
                            .then(editor => 
                              CK_Watchdog.displayStatus(editor, saveButton)
                            )
    );
    wd.setDestructor( editor => editor.destroy());      
    wd.on( 'error', handleEditorError );   
    wd.create( el, {licenseKey: '', width: '80%'}).catch( handleEditorError ).then(setEditorState);
    return wd
  }

  // saves content immediately if user declines to leave page
  static beforeUnloadListener(e){
    e.preventDefault();
    e.returnValue = '';
    const editor = window.watchdog.editor;
    const pendingActions = editor.plugins.get( 'PendingActions' );
    if(Array.from(pendingActions).filter(el => el.message === 'Saving changes').length)
      return editor.plugins.get('Autosave').save(editor)      
  }

  // Update the "Status: Saving..." information.
  static displayStatus( editor, saveButton) {
    const toolbarElement = editor.ui.view.toolbar.element;
    const pendingActions = editor.plugins.get( 'PendingActions' );
    //const saveButton = document.getElementById('saveButton');

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
        window.addEventListener('beforeunload', CK_Watchdog.beforeUnloadListener, {capture: true});
        saveButton.style.background = '#ffcccc'; // a light pink
        saveButton.disabled = false
      } else {
        window.removeEventListener('beforeunload', CK_Watchdog.beforeUnloadListener, {capture: true});      
        saveButton.style.background = '#ccffcc'; // a light green
        saveButton.disabled = true
      }
    });
    return editor
  }  
}