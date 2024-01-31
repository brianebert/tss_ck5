// creates an editor with a CK watchdog wrapped around it.
// Calls a beforeUnload listener to prevent loss of data
export class CK_Watchdog {
  constructor(el){
    function handleEditorError( error ) { // from ckeditor demo
      console.error( 'Oops, something went wrong!' );
      console.error( 'Please, report the following error on https://github.com/ckeditor/ckeditor5/issues with the build id and the error stack trace:' );
      console.warn( 'Build id: 5idtv2qgr0lp-96kg0aobkl70' );
      console.error( error );
    };

    // This block came from CKSource nearly verbatim
/*    const wd = new window.CKSource.EditorWatchdog();
    wd.setCreator( ( element, config={licenseKey: '', width: '80%'} ) => 
      window.CKSource.Editor.create( element, config )
            .catch( handleEditorError )
            .then(editor => {
              //setEditorState();
console.log(`created editor: `, editor);
              return CK_Watchdog.displayStatus(editor);
            })
    );
    wd.setDestructor( editor => editor.destroy());      
    wd.on( 'error', handleEditorError );   
    //wd.create( el, {licenseKey: '', width: '80%'}).catch( handleEditorError ).then(setEditorState);
    return wd
    */
    return window.CKSource.Editor.create(el, {licenseKey: '', width: '80%'})
                          .then(editor => {
                            CK_Watchdog.displayStatus(editor);
            console.log(`CK_Watchdog constructor created editor `, editor);
                            return {editor: editor}
                          })
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
  static displayStatus( editor ) {
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
        window.addEventListener('beforeunload', this.beforeUnloadListener, {capture: true});
        document.getElementById('saveButton').style.background = '#ffcccc'; // a light pink
      } else {
        window.removeEventListener('beforeunload', this.beforeUnloadListener, {capture: true});      
        document.getElementById('saveButton').style.background = '#ccffcc'; // a light green
      }
    });
    return editor
  }  
}