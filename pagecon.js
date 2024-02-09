import { CID } from 'multiformats/cid';

const HASH_SLICE = 10;

let PageClass;

function setPageClass(c){
  PageClass = c;
}

// addOption is a utility function for constructing option lists for the ui
function addOption(elId, value, selected=false, label=true){
  const option = document.createElement('option');
  option.label = label && value.length > 2*7+3 ? `${value.slice(0,7)}...${value.slice(-7)}` : value;
  option.value = value;
  option.selected = selected;
  document.getElementById(elId).appendChild(option);
}

function PageControls(node){
  const outerContext = this;
  this.saveButton = {
    reset: function(){
      this.el.addEventListener('click', async function(e){
        const autoSave = window.editor.plugins.get('Autosave');
        console.log(`autoSave.state is:  ${autoSave.state}`);
        if(autoSave.state === 'waiting')
          await autoSave.save(window.editor);
        PageClass.readOnlyMode(true);        
      }, {signal: outerContext.abortControler.signal});
    }
  };
  this.editingPage = {
    reset: function(node){
      this.el.value = `${node.cid.toString().slice(0,HASH_SLICE)}...${node.cid.toString().slice(-HASH_SLICE)}`;
    }
  };
  this.editingRoot = {
    reset: function(node){
      if(!PageClass.blockParameters.traverse.value || !node.parents.length)
        this.el.value = `${node.cid.toString().slice(0,HASH_SLICE)}...${node.cid.toString().slice(-HASH_SLICE)}`;
    }
  };
  this.pageSelect = {
    reset: function(node){
      //this.el.replaceWith(this.el.cloneNode(true));
      const pages = this.el.children;
      if(pages.length > 0)
        for(const page of Array.from(pages))
          page.selected = page.value === node.cid.toString();
      this.el.addEventListener(
        'change',
        e => PageClass.openPage(node.signingAccount, e.target.value),
        {signal: outerContext.abortControler.signal}
      )
    }
  };
  this.homeButton = {
    reset: function(node){
      if(PageClass.blockParameters.traverse.value && !node.parents.length){
        if(this?.abortControler)
          this.abortControler.abort();
        this.abortControler = new AbortController();
        this.el.addEventListener(
          'click',
          e => PageClass.openPage(node.signingAccount, node.cid.toString()),
          {signal: this.abortControler.signal}
        )
      }
      this.el.disabled = !node.parents.length || !PageClass.blockParameters.traverse.value;
    }
  };
  this.upButton = {
    reset: function(node){
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.disabled = !node.parents.length;
      if(node.parents.length > 0){
        this.el.value = node.parents[0].cid.toString();
        this.el.addEventListener(
          'click',
          e => PageClass.openPage(node.signingAccount, e.target.value),
          {signal: outerContext.abortControler.signal}
        )
      }
    }
  };
  this.editButton = {
    reset: function(node){
      this.el.hidden = false;
      this.el.addEventListener('click', e => PageClass.readOnlyMode(false), {signal: outerContext.abortControler.signal})
    }
  };
  this.editSelect = {
    reset: function(node){
      this.el.hidden = true;
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.children[0].selected = true;
      this.el.addEventListener(
        'change',
        e => Array.from(document.getElementsByClassName('documentEdits')).map(el => el.hidden = el.id !== e.target.value),
        {signal: outerContext.abortControler.signal}
      )
    }    
  };
  this.pageName = {
    reset: function(node){
      this.el.value = '';
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.addEventListener('change', async e => {
        PageClass.blockParameters.traverse.value = false;
        if(e.target.value.length > 0){
          const page = await PageClass.openPage(node.signingAccount, null, e.target.value);
          //await this.mapPages(page) // keys, selectValue not needed since only will create the one option
          //document.getElementById('newPage').hidden = true
        }
      }, {signal: outerContext.abortControler.signal})
    }
  };
  this.linkName = {
    reset: function(node){
      this.el.value = '';
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.addEventListener('change', e => {
        if(e.target.value.length > 0 && outerContext.linkAddress.value.length > 0){
          tryToLink(node, e.target.value, outerContext.linkAddress.value);
          e.target.value = outerContext.linkAddress.value = '';
        }
      }, {signal: outerContext.abortControler.signal})
    }
  };
  this.linkAddress = {
    reset: function(node){
      this.el.value = '';
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.addEventListener('change', e => {
        if(e.target.value.length > 0 && outerContext.linkName.value.length > 0){
          tryToLink(node, outerContext.linkName.value, e.target.value);
          e.target.value = outerContext.linkName.value = '';
        }
      }, {signal: outerContext.abortControler.signal})
    }
  };
  this.unlinkName = {
    reset: function(node){
      this.el.value = '';
      //for(const [key, value] of Object.entries(node.pageLinks.links))
        //addOption('unlinkNames', key, false, false);
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.addEventListener('change', e => {
        if(e.target.value.length > 0 ){
          node.pageLinks.rm(e.target.value);
          PageClass.startAutosave(node);
        }
      }, {signal: outerContext.abortControler.signal})
    }  
  };
  this.rmAddress = {
    reset: function(node){
      this.el.value = '';
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.addEventListener('change', e => {
        if(e.target.value.length){
          const addressInputOption = Array.from(document.getElementById('addresses').children)
                                          .filter(child => child.value === e.target.value);
          if(addressInputOption.length)
            addressInputOption.pop().remove();
          PageClass.rm(e.target.value);
        //node.bottomBar.rmAddress.value = '';
          PageClass.openPage(node.signingAccount, '');
          PageClass.blockParameters.addressInput.value = '';
        }
      }, {signal: outerContext.abortControler.signal})
    }
  };
  this.oldName = {
    reset: function(node){
      this.el.value = node.name.length ? node.name : 'unnamed';
    }
  };
  this.newName = {
    reset: function(node){
      this.el.value = '';
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.addEventListener('change', e => {
        if(e.target.value.length){
          PageClass.startAutosave(node);
        }
      }, {signal: outerContext.abortControler.signal});
    }
  };
  // tryToLink is called by linkName and linkAddress change handlers
  function tryToLink(page, name, address){
console.log(`trying to link ${name} to ${address} on page ${page.name}`)
    try {
      const cid = CID.parse(address);
      page.pageLinks.push(name, cid);
      page.pageLinks.render();
      outerContext.editSelect.reset();
      PageClass.startAutosave(page);
//page.bottomBar.editSelect.el; Why is this here?
    } catch (err) {
      console.error(`caught error linking pages ${page.cid.toString()} and ${address} with name ${name}`, err);
    }
  }
  function cloneUniquely(el){
    const elNew = el.cloneNode(false);
    el.parentElement.appendChild(elNew);
    for(const child of Array.from(el.children))
      elNew.appendChild(child);
    //el.remove();
    return elNew
  }
  // abortControler.abort() is called in CKE%_Page.openPage()
  Object.defineProperty(this, 'abortControler', {
    value: new AbortController(),
    configurable: false,
    enumerable: false
  });
  Object.defineProperty(this, 'reset', {
    value: function(node){
      for(const [key, value] of Object.entries(this))
        value.reset(node);
      return this
    },
    configurable: false,
    enumerable: false
  });
  const textInputArray = Array.from(document.getElementById('pageEditInputs').getElementsByTagName('input'));
  for(const key of Object.keys(this)){
    this[key].el = document.getElementById(key);
    //this[key].el = cloneUniquely(document.getElementById(key)); // cloneUniquely removes el.id from DOM 
    textInputArray.map(input => input.addEventListener('keyup', e => {
      if(input.id.endsWith('Name'))
        if(3 + input.value.length > input.size)
          input.size = 3 + input.value.length;
      e.target.setCustomValidity('');
      if(!e.target.reportValidity())
        e.target.setCustomValidity(`name cannot be ${e.target.value}`);
    }, {signal: outerContext.abortControler.signal}));  
    Object.defineProperty(this[key], 'value', {
      get: function(){
        return this.el.value
      },
      set: function(value){
        return this.el.value = value
      },
      configurable: true,
      enumerable: false,
    });
  }
console.log(`resetting this.`, Object.keys(this))
  this.reset(node);
console.log(`constructed PageControls `, this);
}

export {PageControls, setPageClass};