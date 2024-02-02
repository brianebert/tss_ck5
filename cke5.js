import {Encrypted_Node} from '@brianebert/tss';
import {CK_Editor} from './editor.js';
import { CID } from 'multiformats/cid'


function PageControls(node){
  const outerContext = this;
  this.saveButton = {
    reset: function(){
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.addEventListener('click', async e => {
        const autoSave = window.editor.plugins.get('Autosave');
        console.log(`autoSave is: `, autoSave);
        if(autoSave.state === 'waiting')
          await autoSave.save(window.editor);
        CKE5_Page.readOnlyMode(true);
      })
    }
  };
  this.editingPage = {
    reset: function(node){
      if(Object.hasOwn(node.value, 'editorContents'))
        this.el.value = node.cid.toString();
      else
        this.el.value = '';
    }
  };
  this.editingRoot = {
    reset: function(node){
      if(Object.hasOwn(node.value, 'editorContents'))
        this.el.value = node.cid.toString();
      else
        this.el.value = '';
    }
  };
  this.oldName = {
    reset: function(node){
      this.el.value = node.name.length ? node.name : 'unnamed';
    }
  };
  this.newName = {
    reset: function(){
      this.el.value = '';
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.addEventListener('change', e => {
        if(e.target.value.length)
          CKE5_Page.startAutosave();
      });
    }
  };
  this.pageSelect = {
    reset: function(node){
      //this.el.replaceWith(this.el.cloneNode(true));
      const pages = this.el.children;
      if(pages.length > 0)
        for(const page of Array.from(pages))
          page.selected = page.value === node.cid.toString();
      this.el.addEventListener('change', e => CKE5_Page.openPage(node.signingAccount, e.target.value))
    }
  };
  this.homeButton = {
    reset: function(node){
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.value = node.cid.toString();
      this.el.disabled = !node.parents.length;
      this.el.addEventListener('click', e => CKE5_Page.openPage(node.signingAccount, e.target.value))
    }
  };
  this.upButton = {
    reset: function(node){
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.disabled = !node.parents.length;
      if(node.parents.length > 0){
        this.el.value = node.parents[0].cid.toString();
        this.el.addEventListener('click', e => CKE5_Page.openPage(node.signingAccount, e.target.value))
      }
    }
  };
  this.editButton = {
    reset: function(node){
      this.el.hidden = false;
      //this.el.replaceWith(this.el.cloneNode(true));
  console.log(`refreshed `, this.el);
      this.el.addEventListener('click', e => CKE5_Page.readOnlyMode(false))
    }
  };
  this.editSelect = {
    reset: function(node){
      this.el.hidden = true;
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.children[0].selected = true;
      this.el.addEventListener('change', e => 
        Array.from(document.getElementsByClassName('documentEdits'))
             .map(el => el.hidden = el.id !== e.target.value))
    }    
  };
  this.pageName = {
    reset: function(node){
      this.el.value = '';
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.addEventListener('change', async e => {
        if(e.target.value.length > 0){
          const page = await CKE5_Page.openPage(node.signingAccount, null, e.target.value);
          //await this.mapPages(page) // keys, selectValue not needed since only will create the one option
          //document.getElementById('newPage').hidden = true
        }
      })
    }
  };
  this.linkName = {
    reset: function(node){
      this.el.value = '';
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.addEventListener('change', e => {
        if(e.target.value.length > 0 && outerContext.linkAddress.value.length > 0)
          tryToLink(node, e.target.value, outerContext.linkAddress.value)
      })
    }
  };
  this.linkAddress = {
    reset: function(node){
      this.el.value = '';
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.addEventListener('change', e => {
        if(e.target.value.length > 0 && outerContext.linkName.value.length > 0)
          tryToLink(node, outerContext.linkName.value, e.target.value)
      })
    }
  };
  this.unlinkName = {
    reset: function(node){
      this.el.value = '';
      //this.el.replaceWith(this.el.cloneNode(true));
      this.el.addEventListener('change', e => {
        if(e.target.value.length > 0 )
          node.pageLinks.rm(e.target.value);
      })
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
          CKE5_Page.rm(e.target.value);
        //node.bottomBar.rmAddress.value = '';
          CKE5_Page.openPage(node.signingAccount, '');
          CKE5_Page.blockParameters.addressInput.value = '';
        }
      })
    }
  };
  // tryToLink is called by linkName and linkAddress change handlers
  function tryToLink(page, name, address){
    try {
      const cid = CID.parse(address);
      page.pageLinks.push(name, cid);
      page.pageLinks.render();
      page.bottomBar.editSelect.el;
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
  Object.defineProperty(this, 'reset', {
    value: function(node){
      for(const [key, value] of Object.entries(this))
        value.reset(node);
      return this
    },
    configurable: false,
    enumerable: false,
  });
  const textInputArray = Array.from(document.getElementById('pageEditInputs').getElementsByTagName('input'));
  for(const key of Object.keys(this)){
    this[key].el = document.getElementById(key);
    //this[key].el = cloneUniquely(document.getElementById(key)); // cloneUniquely removes el.id from DOM 
    textInputArray.map(input => input.addEventListener('keyup', e => {
      input.size = 3 + input.value.length;;
      e.target.setCustomValidity('');
      if(!e.target.reportValidity())
        e.target.setCustomValidity(`name cannot be ${e.target.value}`);
    }))  
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
  this.reset(node);
console.log(`constructed PageControls `, this);
}

class CKE5_Page extends Encrypted_Node {
  #bottomBar;
  constructor(){
    super(...arguments);
    // element editor uses
    this.editorEl = document.querySelector('.editor');
    this.pageLinks = {
      // floats links from page source for editing
      // links property is added in CKE5_Page.refreshPaveview
      onclick: e => CKE5_Page.openPage(this.signingAccount, e.target.value),
      push: function(key, value){
        if(Object.keys(this.links).includes(key) || Object.values(this.links).includes(value))
          throw new Error(`cannot set new link from ${key} or to ${value}`)
        this.links[key] = value;
      },
      render: function(){
        const parentEl = document.getElementById('subPages');
        parentEl.innerHTML = '';
        for(const [key, value] of Object.entries(this.links)){
          const button = document.createElement('button');
          button.addEventListener('click', this.onclick);
          button.id = `${key}SubpageButton`;
          button.value = value.toString();
          button.textContent = key;
          parentEl.appendChild(button);
        }
      },
      rm(key){
        if(Object.hasOwn(this.links, key)){
          document.getElementById(`${key}SubpageButton`).remove();
          this.links[key] = undefined;
        }
      },
      update: function(values){
        for(const [key, value] of Object.entries(this.links))
          if(value !== undefined)
            values[key] = value;
          else
            delete values[key];
          return values
      }
    };
  }

  get bottomBar(){
    return this.#bottomBar
  }

  get isDocumentRoot(){
    return !!this.parents.length && CK_Editor.blockParameters.traverse.value
  }

  static set params(params){
    this.blockParameters = params;
  }

  static async mapPages(root, keys, selectValue){
console.log(`populating page selector for ${root.name} with ${selectValue} selected.`);
    const subPageLinks = Array.from(document.getElementById('subPages').children);
    subPageLinks.map(link => link.disabled = true);
    const el = root.bottomBar.pageSelect.el;
    el.disabled = true;
    el.innerHTML = '';
    const opts = [];
    function populateSelectOption(page, depth){
console.log(`creating page select option ${page.name}, value ${page.cid.toString()}`);
      const pageOption = document.createElement('option');
      let indent;
      for(indent=''; depth; depth--)
        indent += '**|';
      pageOption.label = indent + ' ' + page.name;
      pageOption.value = page.cid.toString();
      pageOption.selected = pageOption.value === selectValue;
      opts.unshift(pageOption);
      return Promise.resolve();
    }
    if(CKE5_Page.blockParameters.traverse.value){
      await this.traverse(root.cid, populateSelectOption, keys);
      subPageLinks.map(link => link.disabled = false);
    }
    else
      populateSelectOption(root, 0);
    for(const option of opts)
      el.append(option);
    el.disabled = false;
  }

  static async openPage(signingAccount, address=null, name=''){
  console.log(`entered openPage() with name ${name}, address ${address} signingAccount `, signingAccount);
    // save old page if necessary
    if(window?.editor){  
      const editor = window.editor;
      const pendingActions = editor.plugins.get('PendingActions');
      if(Array.from(pendingActions).filter(pa => pa.message === 'Saving changes').length){
        console.log(`must save ${window.collab.name} before loading new page`);
        await editor.plugins.get('Autosave').save(editor);
      }
    }
    // make keys
    switch(this.blockParameters.inKeys.value){
    case 'plaintext':
      var keys = null;
      break;
    case 'add':
      const other = document.getElementById('addFrom');
      addOption('inKeys', other.value, true);
      var keys = await signingAccount.keys.readFrom(other.value);
      break;
    default:
      var keys = await signingAccount.keys.readFrom(this.blockParameters.inKeys.value);
    }
    
    try {
      if(address){
  console.log(`reading page from address ${address} with keys `, keys);
        window.collab = await this.fromCID(signingAccount, address, keys);
      }
      else {
  console.log(`creating page ${name} using signingAccount `, signingAccount);
        const prompt0 = `<h1>Welcome!</h1><p>to get started, enter or choose "<span style="color:hsl(0, 0%, 60%);">Document Address</span>`;
        const prompt1 = `" at the upper left then click "<b>read</b>," or click "<b>Edit Document</b>" on the lower right</p>`;
        window.collab = new this({colName: name, editorContents: prompt0 + prompt1}, signingAccount);
        await window.collab.ready;
  console.log(`created page ${window.collab.name} `, window.collab);
      }
      await this.refreshPageview(window.collab);
      console.log(`${window.collab.name}'s subpage links are: `, window.collab.links);
      return window.collab
    } catch (err) {
      console.error(`error opening ${address}`, err);
    }  
  }

  static lockId = Symbol();
  static readOnlyMode(bool){
    console.log(`entered readOnlyMode(${bool}) window.collab: `, window?.collab);
    console.log(`and window.editor: `, window.editor);
    const editor = window.editor;
    const bB = window.collab.bottomBar;
    bB.editSelect.el.children[0].selected = true;
    Array.from(document.getElementsByClassName('documentEdits')).map(el => el.hidden = true);
    bool ? editor.enableReadOnlyMode(this.lockId) : editor.disableReadOnlyMode(this.lockId);
    bB.editSelect.el.hidden = bB.saveButton.el.disabled = bool;
    bB.editButton.el.hidden = !bool;
  }

  static async refreshPageview(node){
    console.log(`refreshing page for `, node);
    node.#bottomBar = new PageControls(node);
    if(Object.hasOwn(window, 'editor'))
      window.editor.destroy();
    node.editorEl.innerHTML = node.value.editorContents;
    window.editor = await new CK_Editor(node.editorEl, node.#bottomBar.saveButton.el);
    node.pageLinks.links = node.links;
    node.pageLinks.render();
    this.readOnlyMode(true);
    if(node.parents.length === 0)
      if(this.blockParameters.traverse.value)
        this.mapPages(node, await node.signingAccount.keys.readFrom(this.blockParameters.inKeys.value), node.cid.toString());
      else
        this.mapPages(node);
    window.scroll(0,0);    
  }

  static startAutosave(){
    // Any comment will trigger CKEditor5 autosave and is stripped too!
    window.editor.setData('<!-- -->' + window.editor.getData())
  }

  // do not call directly. It will be called by the Editor's autosave module.
  async saveData(editor){
    console.log(`saving data for this: `, this);
    let value = Object.assign({}, this.value);
    if(this.#bottomBar.newName.value.length > 0)
      value.colName = this.#bottomBar.newName.value;
    value = this.pageLinks.update(value);
    value.editorContents = editor.getData();
    const keys = await this.signingAccount.keys.writeTo('self');
console.log(`encrypting for self with keys `, keys);
    return this.update(value, keys).then(async root => {
      this.#bottomBar.reset(this);
      this.#bottomBar.editingRoot.reset(root);
      /*this.#bottomBar.editingRoot.reset(root);
      this.#bottomBar.editingPage.reset(this);
      this.#bottomBar.homeButton.reset(root);
      this.#bottomBar.editSelect.reset(this);
      this.#bottomBar.editButton.reset(this);
      this.#bottomBar.upButton.reset(this);*/
      CKE5_Page.persist(root, keys);
      CKE5_Page.mapPages(
        root, await this.signingAccount.keys.readFrom('self'), 
        this.cid.toString()
      );
    })
  }
}
window.CKE5_Page = CKE5_Page; // delete this after debug
export {CKE5_Page};