import {Encrypted_Node, SigningAccount} from '@brianebert/tss';
import {CK_Watchdog} from './editor.js';
import { CID } from 'multiformats/cid'


function PageControls(node){
  const outerContext = this;
  this.saveButton = {
    reset: function(){
      this.el.addEventListener('click', async e => {
        const autoSave = window.watchdog.editor.plugins.get('Autosave');
        console.log(`autoSave is: `, autoSave);
        if(autoSave.state === 'waiting')
          await autoSave.save(window.watchdog.editor);
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
      this.el.value = node.name;
    }
  };
  this.newName = {
    reset: function(){
      this.el.value = '';
    }
  };
  this.pageSelect = {
    reset: function(node){
      const pages = this.el.children;
      if(pages.length > 0)
        for(const page of Array.from(pages))
          page.selected = page.value === node.cid.toString();
      this.el.addEventListener('change', e => CKE5_Page.openPage(node.signingAccount, e.target.value))
    }
  };
  this.homeButton = {
    reset: function(node){
      this.el.value = node.cid.toString();
      this.el.disabled = !node.parents.length;
      this.el.addEventListener('click', e => CKE5_Page.openPage(node.signingAccount, e.target.value))
    }
  };
  this.upButton = {
    reset: function(node){
      if(node.parents.length > 0){
        this.el.value = node.parents[0].cid.toString();
        this.el.disabled = !node.parents.length;
        this.el.addEventListener('click', e => CKE5_Page.openPage(node.signingAccount, e.target.value))
      }
    }
  };
  this.editButton = {
    reset: function(node){
      this.el.addEventListener('click', e => CKE5_Page.readOnlyMode(false))
    }
  };
  this.editSelect = {
    reset: function(){
      this.el.addEventListener('change', e => 
        Array.from(document.getElementsByClassName('documentEdits'))
             .map(el => el.hidden = el.id !== e.target.value))
    }    
  };
  this.pageName = {
    reset: function(){
      this.el.value = '';
      this.el.addEventListener('change', async e => {
        if(e.target.value.length > 0){
          const page = await CKE5_Page.openPage(node.signingAccount, null, e.target.value);
          await this.mapPages(page) // keys, selectValue not needed since only will create the one option
          //document.getElementById('newPage').hidden = true
        }
      })
    }
  };
  this.linkName = {
    reset: function(node){
      this.el.value = '';
      this.el.addEventListener('change', e => {
        if(e.target.value.length > 0 && this.linkAddress.value.length > 0)
          tryToLink(node, e.target.value, this.linkAddress.value)
      })
    }
  };
  this.linkAddress = {
    reset: function(node){
      this.el.value = '';
      this.el.addEventListener('change', e => {
        if(e.target.value.length > 0 && this.linkName.value.length > 0)
          tryToLink(node, this.linkName.value, e.target.value)
      })
    }
  };
  this.unlinkName = {
    reset: function(node){
      this.el.value = '';
      this.el.addEventListener('change', e => {
        if(e.target.value.length > 0 )
          node.pageLinks.rm(e.target.value);
      })
    }  
  };
  this.rmAddress = {
    reset: function(){
      this.el.value = '';
      this.el.addEventListener('change', e => {
        Array.from(document.getElementById('addresses')).filter(child => child.value === e.target.value).map(child => child.remove());
        // ?? CKE5_Page.topBar.addressInput.dispatchEvent(new Event('change'));
        CKE5_Page.rm(e.target.value);
      })
    }
  };
  // tryToLink is called by linkName and linkAddress change handlers
  function tryToLink(page, name, address){
    try {
      const cid = CID.parse(address);
      page.pageLinks.push(name, cid);
      page.pageLinks.render();
    } catch (err) {
      console.error(`caught error linking pages ${page.cid.toString()} and ${address} with name ${name}`, err);
    }
  }
  Object.defineProperty(this, 'reset', {
    value: function(node){
      const textInputs = [...document.getElementsByClassName('nameInput'),...document.getElementsByClassName('addressInput')];
      for(const [key, value] of Object.entries(this))
        value.reset(node);
      textInputs.map(input => input.addEventListener('keyup', e => {
        el.size = 4 + el.value.length;;
        e.target.setCustomValidity('');
        if(!e.target.reportValidity())
          e.target.setCustomValidity(`name cannot be ${e.target.value}`);
      }))
      return this
    },
    configurable: false,
    enumerable: false,
  });
console.log(`constructing PageControls with keys `, Object.keys(this));
  for(const key of Object.keys(this)){
    this[key].el = document.getElementById(key);      
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
console.log(`initialized ${key}`);
  }
  this.reset(node);
}

class CKE5_Page extends Encrypted_Node {
  #root; #bottomBar;
  constructor(){
    super(...arguments);
    this.#root = this.cid;
    // element editor uses
    this.editorEl = document.querySelector('.editor');
    this.pageLinks = {
      links: {},
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
      }
    };
  }

  get root(){
    return this.#root
  }

  get bottomBar(){
    return this.#bottomBar
  }

  static topBar;

  static async mapPages(root, keys, selectValue){
console.log(`populating page selector for ${root.name} with ${selectValue} selected.`);
    const subPageLinks = Array.from(document.getElementById('subPages').children);
    subPageLinks.map(link => link.disabled = true);
    const el = document.getElementById('pageSelect');
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
    if(CKE5_Page.topBar.traverse.value){
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
    if(window?.watchdog){
      const editor = window.watchdog.editor;
      const pendingActions = editor.plugins.get('PendingActions');
      if(Array.from(pendingActions).filter(pa => pa.message === 'Saving changes').length){
        console.log(`must save ${window.collab.name} before loading new page`);
        await editor.plugins.get('Autosave').save(editor);
      }
    }
    // make keys
    switch(this.topBar.inKeys.value){
    case 'plaintext':
      var keys = null;
      break;
    case 'add':
      const other = document.getElementById('addFrom');
      addOption('inKeys', other.value, true);
      var keys = await signingAccount.keys.readFrom(other.value);
      break;
    default:
      var keys = await signingAccount.keys.readFrom(this.topBar.inKeys.value)
    }
    
    try {
      if(address){
  console.log(`reading page from address ${address} with keys `, keys);
        window.collab = await this.fromCID(signingAccount, address, keys);
      }
      else {
  console.log(`creating page ${name} using signingAccount `, signingAccount);
        window.collab = new this({colName: name}, signingAccount);
        await window.collab.ready;
  console.log(`created page ${window.collab.name} `, window.collab);
      }
      CKE5_Page.refreshPageview();
      window.collab.cache = this.cache; // here for debugging. Can remove later
      console.log(`${window.collab.name}'s subpage links are: `, window.collab.links);
      return window.collab
    } catch (err) {
      console.error(`error opening ${address}`, err);
    }  
  }

  static lockId = Symbol();
  static readOnlyMode(bool){
    console.log(`entered readOnlyMode(${bool}) window.collab: `, window?.collab);
    const bB = window.collab.bottomBar;
    const editor = window.watchdog.editor;
    bool ? editor.enableReadOnlyMode(this.lockId) : editor.disableReadOnlyMode(this.lockId);
    Array.from(document.getElementsByClassName('documentEdits')).map(el => el.hidden = true);
    bB.editSelect.el.hidden = bB.saveButton.el.disabled = bool;
    bB.editButton.el.hidden = !bool;
  }

  static refreshPageview(){
    const node = window.collab;
    console.log(`refreshing page for `, node);
    if(Object.hasOwn(window, 'watchdog'))
      window.watchdog.destroy();
    node.#bottomBar = new PageControls(node);
    if(Object.hasOwn(node.value, 'editorContents'))
      node.editorEl.innerHTML = node.value.editorContents;
    else
      node.editorEl.innerHTML = '';
/*
    node.elements = [];
    for(const elId of node.elIds){
      // strip listeners from elements of UI
      const el = document.getElementById(elId);
console.log(`calling replaceWith() on element id ${elId}`);
      el.replaceWith(node.elements[elId] = el.cloneNode(true));
    }

    // populate editor contents and "Page Address" of UI
    if(Object.hasOwn(node.value, 'editorContents')){
      node.elements.editingRoot.value = node.root.toString();
      node.elements.editingPage.value = node.cid.toString();
      node.editorEl.innerHTML = node.value.editorContents;
    } else {
      node.elements.editingPage.value = '';
      node.elements.editingRoot.value = '';
      node.editorEl.innerHTML = '';
    }

    if(!!node.parents.length){
      document.getElementById('homeButton').disabled = false;
      node.elements['upButton'].addEventListener('click', e => 
        CKE5_Page.openPage(node.signingAccount, e.target.value)
      );
      node.elements['upButton'].value = node.parents[0].cid.toString();
      node.elements['upButton'].disabled = false;
    } else {
      document.getElementById('homeButton').disabled = true;
      node.elements['upButton'].disabled = true;
    }

    const subpagesEl = document.getElementById('subPages');
    for(const [key, value] of Object.entries(node.links))
      if(!key.endsWith('_last'))
        node.pageLinks.push(key, value);
    node.pageLinks.renderBeneath(subpagesEl);



    node.elements.editButton.addEventListener('click', e => {
      console.log(`clicked editButton`);
      return CKE5_Page.readOnlyMode(false)
    });
    document.getElementById('saveButton').addEventListener('click', async e => {
      const autoSave = window.watchdog.editor.plugins.get('Autosave');
      console.log(`autoSave is: `, autoSave);
      if(autoSave.state === 'waiting')
        await autoSave.save(window.watchdog.editor);
      this.readOnlyMode(true);
    });
    document.getElementById('subpagesLabel').hidden = !subpagesEl.children.length;
    for(let i = 0; i < subpagesEl.children.length; i++)
      subpagesEl.children[i].addEventListener('click', e => CKE5_Page.openPage(node.signingAccount, e.target.value));

    node.elements.pageSelect.addEventListener('change', e => CKE5_Page.openPage(node.signingAccount, e.target.value));
    //node.elements.rmSelect.addEventListener('change', e => node.rmSubpage(e));
    node.elements.editSelect.addEventListener('change', e => {
      Array.from(document.getElementsByClassName('documentEdits')).map(el => el.hidden = el.id !== e.target.value)
    })

    node.elements.pageName.addEventListener('change', async e => {
      if(e.target.value.length > 0){
        const page = await this.openPage(node.signingAccount, null, e.target.value);
        await this.mapPages(page) // keys, selectValue not needed since only will create the one option
        //document.getElementById('newPage').hidden = true
      }
    });

    function linkPage(node){
      const nameEl = node.elements.linkName;
      const addressEl = node.elements.linkAddress;

      return (e) => {
        const name = nameEl.value;
        const address = addressEl.value;
        if(address.length > 0 && name.length > 0 && !Object.hasOwn(node.pageLinks.links, name))
          try {
            const cid = CID.parse(address);
            node.pageLinks.push(name, cid);
            node.pageLinks.renderBeneath(subpagesEl);
          } catch (err) {
            console.error(`caught error linking pages ${node.cid.toString()} and ${address} with name ${name}`, err);
          }
      }
    }

    node.elements.linkName.addEventListener('change', linkPage(node));
    node.elements.linkAddress.addEventListener('change', linkPage(node));

    node.elements.unlinkName.addEventListener('change', e => {
      if(e.target.value in node.pageLinks.links)
        node.pageLinks.rm(e.target.value);
    })

    node.elements.rmAddress.addEventListener('change', e => {
      Array.from(document.getElementById('addresses')).filter(child => child.value === e.target.value).map(child => child.remove());
      CKE5_Page.blockParameters.addressInput.dispatchEvent(new Event('change'));
      this.rm(e.target.value);
    });

    node.elements.newName.addEventListener('change', e => {
      if(e.target.value.length > 0 && e.target.value !== node.name)
        this.startAutosave();
    });

    const nameInputs = Array.from(document.getElementsByClassName('nameInput'));
console.log(`filtered ${nameInputs.length} name input elments: `, nameInputs);
    for(const el of nameInputs){
      el.addEventListener('keydown', e => el.size++);
      el.addEventListener('keyup', e => {
        el.size = el.value.length ? el.value.length : 4;
        e.target.setCustomValidity('');
        if(!e.target.reportValidity())
          e.target.setCustomValidity(`name cannot be ${e.target.value}`);
      });
    }

    // set page selector to current page
    const pages = node.elements['pageSelect'].children;
    if(pages.length > 0)
      for(const page of Array.from(pages))
        page.selected = page.value === node.cid.toString();
    node.elements['pageSelect'].disabled = false;
*/
    window.watchdog = new CK_Watchdog(
      node.editorEl, 
      () => CKE5_Page.readOnlyMode(true), 
      document.getElementById('saveButton')
    );    
    window.scroll(0,0);
  }

  static startAutosave(){
    // Any comment will trigger CKEditor5 autosave and is stripped too!
    window.watchdog.editor.setData('<!-- -->' + window.watchdog.editor.getData())
  }

  // do not call directly. It will be called by the Editor's autosave module.
  async saveData(editor){
    console.log(`saving data for this: `, this);
    const value = Object.assign({}, this.value);
    if(this.#bottomBar.newName.value.length > 0)
      value.colName = this.#bottomBar.newName.value;
    this.pageLinks.update(value);
    value.editorContents = editor.getData();
    const keys = await this.signingAccount.keys.writeTo('self');
console.log(`encrypting for self with keys `, keys);
    return this.update(value, keys).then(async root => {
      this.#root = root;
      document.getElementById('homeButton').value = root.cid.toString();
      document.getElementById('editingRoot').value = root.cid.toString();
      document.getElementById('editingPage').value = this.cid.toString();
      if(this.parents.length)
        // this needs to take into account when there are more than one parent.
        document.getElementById('upButton').value = this.parents[0].cid.toString();
      CKE5_Page.persist(root, keys);
      CKE5_Page.mapPages(
        root, await this.signingAccount.keys.readFrom('self'), 
        this.cid.toString()
      );
    })
  }
}

export {CKE5_Page};