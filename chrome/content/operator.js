var Operator = {
  /* Our own dataformats array for UI purposes - includes Microformats+RDFa */
  dataformats: [],
  eTLDService: null,
  /* Operator preference branch */
  prefBranch: null,
  /* Variables for preferences */
  /* Whether or not debug is on */
  debug: false,
  /* Current view - 0=data formats, 1=actions */
  view: 0,
  /* Set to false if we shouldn't do stuff */
  updateMenus: true,
  /* Whether or not the upcoming bug related to inclusive DTEND is fixed */ 
  upcomingBugFixed: false,
  /* Should microformats be highlighted on mouseover and when selected */
  highlightMicroformats: false,
  /* Should data formats use descriptive names */
  useDescriptiveNames: true,
  /* Should we remove duplicates microformats */
  removeDuplicates: true,
  /* Should we show hidden microformats */
  showHidden: false,
  /* Should we show allow invalid tags */
  allowInvalidTags: false,
  /* Should we observe all changes in the DOM */
  observeDOMAttrModified: false,
  /* Is there an icon on the statusbar */
  statusbar: false,
  /* Is there an icon on the URL bar */
  urlbar: false,
  /* Should we autohide the toolbar */
  autohide: false,
  /* Should we use short descriptions for the actions */
  useShortDescriptions: false,
  /* This is set to true by options before setting all other prefs */
  /* This allows us to not update the Operator UI until all pref changes */
  /* are done */
  batchPrefChanges: false,
  /* Pointer to the bundle for operator.properties */
  languageBundle: null,
  /* Store the current highlighted element so we can unhighlight it */
  highlightedElement: null,
  /* Store the higlighted element's old style so we can put it back */
  highlightedElementOutlineStyle: null,
  /* If timerID is set, we know that we're being acted on by a delay. */
  /* The delay is so that if 100 DOM changes happen, we don't do 100 checks */
  /* for microformats. */
  timerID: null,
  /* Operator maintains its own list of actions that copies SemanticActions */
  /* This is so we can mess with some of the data like descriptions */
  /* It has a customer iterator so you can enumerator over Operator.actions */
  actions: {
    /* When an action is added, the name is placed in this list */
    /* Clashes, etc. were resolved by SemanticActions */
    list: [],
    add: function add(action, actionDefinition) {
      Operator.actions[action] = actionDefinition;
      Operator.actions.list.push(action);
    },
    __iterator__: function () {
      var i;
      for (i=0; i < this.list.length; i++) {
        yield this.list[i];
      }
    }
  },
  actionObjectsFromDocument: function actionObjectsFromDocument(doc) {
    var actionObjects = [];
    var namespaceURI = "http://www.microsoft.com/schemas/openservicedescription/1.0";


    var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    var homepageUrl = doc.getElementsByTagNameNS(namespaceURI, "homepageUrl")[0];
    var host = ioService.newURI(homepageUrl.textContent.replace(/^\s*|\s*$/g,''), null, null).host;
    
    var display = doc.getElementsByTagNameNS(namespaceURI, "display")[0];
    var description = display.getElementsByTagNameNS(namespaceURI, "name")[0].textContent.replace(/^\s*|\s*$/g,'');
    var icon;
    try {
      icon = display.getElementsByTagNameNS(namespaceURI, "icon")[0].textContent.replace(/^\s*|\s*$/g,'');
    } catch (ex) {
      /* Icon is optional */
    }
    var activity = doc.getElementsByTagNameNS(namespaceURI, "activity")[0];
    var category = activity.getAttribute("category").replace(/^\s*|\s*$/g,'');

    var activityActions = activity.getElementsByTagNameNS(namespaceURI, "activityAction");
    for (let i=0; i<activityActions.length; i++) {
      var actionObject = {};
      actionObject.host = host;
      actionObject.category = category;
      actionObject.description = description;
      if (icon) {
        actionObject.icon = icon;
      }
      try {
        var Domain = activityActions[i].getAttribute("domain").replace(/^\s*|\s*$/g,'');
      } catch (ex) {
      }
      var Context = activityActions[i].getAttribute("context").replace(/^\s*|\s*$/g,'');
      var ContextArray = Context.split(".");
      if (Microformats[ContextArray[0]] || Domain) {
        if (!actionObject.scope) {
          actionObject.scope = {};
        }
        if (Domain) {
          actionObject.scope.url = "http://" + Domain;
        }
        if (!actionObject.scope.semantic) {
          actionObject.scope.semantic = {};
        }
        /* No subproperties */
        if (ContextArray.length == 1) {
          actionObject.scope.semantic[Context] = Context;
        } else {
          // XXX TODO - support a.b.c (we only support a.b)
          actionObject.scope.semantic[ContextArray[0]] = ContextArray[1];
        }
      }
      var execute = activityActions[i].getElementsByTagNameNS(namespaceURI, "execute")[0];
      var Execute = {};
      if (execute.hasAttribute("accept-charset")) {
        Execute["Accept-charset"] = execute.getAttribute("accept-charset").replace(/^\s*|\s*$/g,'');
      }
      if (execute.hasAttribute("enctype")) {
        Execute.Enctype = execute.getAttribute("enctype").replace(/^\s*|\s*$/g,'');
      }
      if (execute.hasAttribute("method")) {
        Execute.Method = execute.getAttribute("method").replace(/^\s*|\s*$/g,'');
      } else {
        Execute.Method = "GET";
      }
      if (execute.hasAttribute("action")) {
        Execute.Action = execute.getAttribute("action").replace(/^\s*|\s*$/g,'');
        var parameters = execute.getElementsByTagNameNS(namespaceURI, "parameter");
        var Parameters = [];
        if (parameters.length > 0) {
          for (let j=0; j<parameters.length; j++) {
            var Parameter = {};
            Parameter.Name = parameters[j].getAttribute("name").replace(/^\s*|\s*$/g,'');
            Parameter.Value = parameters[j].getAttribute("value").replace(/^\s*|\s*$/g,'');
            if (parameters[j].hasAttribute("type")) {
              Parameter.Type = parameters[j].getAttribute("type").replace(/^\s*|\s*$/g,'');
            }
            Parameters.push(Parameter);
          }
        }


        function doActionCallbackGenerator(Execute, Parameters) {
          return function(semanticObject, semanticObjectType, propertyIndex, event) {
            var action = Execute.Action;
            var parameters = [];
            for (let j=0; j < Parameters.length; j++) {
              parameters[j] = Parameters[j].Value;
            }
            for (property in Microformats[semanticObjectType].properties) {
              if (semanticObject[property]) {
                if (Microformats[semanticObjectType].properties[property].plural) {
                  action = action.replace('{' + property + '}', encodeURIComponent(semanticObject[property].join(',')));
                  for (let j=0; j < Parameters.length; j++) {
                    parameters[j] = parameters[j].replace('{' + property + '}', encodeURIComponent(semanticObject[property].join(',')));
                  }
                } else {
                  action = action.replace('{' + property + '}', encodeURIComponent(semanticObject[property]));
                  for (let j=0; j < Parameters.length; j++) {
                    parameters[j] = parameters[j].replace('{' + property + '}', encodeURIComponent(semanticObject[property]));
                  }
                }
                if (Microformats[semanticObjectType].properties[property].subproperties) {
                  for (subproperty in Microformats[semanticObjectType].properties[property].subproperties) {
                    if (semanticObject[property][subproperty]) {
                      if (Microformats[semanticObjectType].properties[property].subproperties[subproperty].plural) {
                        action = action.replace('{' + property + '.' + subproperty + '}', encodeURIComponent(semanticObject[property][subproperty].join(',')));
                        for (let j=0; j < Parameters.length; j++) {
                          parameters[j] = parameters[j].replace('{' + property + '.' + subproperty + '}', encodeURIComponent(semanticObject[property][subproperty].join(',')));
                        }
                      } else {
                        action = action.replace('{' + property + '.' + subproperty + '}', encodeURIComponent(semanticObject[property][subproperty]));
                        for (let j=0; j < Parameters.length; j++) {
                          parameters[j] = parameters[j].replace('{' + property + '.' + subproperty + '}', encodeURIComponent(semanticObject[property][subproperty]));
                        }
                      }
                    } else {
                      action = action.replace('{' + property + '.' + subproperty + '}', "");
                      for (let j=0; j < Parameters.length; j++) {
                        parameters[j] = parameters[j].replace('{' + property + '.' + subproperty + '}', "");
                      }
                    }
                  } /* for (subproperty in Microformats[semanticObjectType].properties[property].subproperties) */
                }
              } else {
                action = action.replace('{' + property + '}', "");
                for (let j=0; j < Parameters.length; j++) {
                  parameters[j] = parameters[j].replace('{' + property + '}', "");
                }
              }
            } /* for (property in Microformats[semanticObjectType].properties) */
            
            var query = "";
            for (let j=0; j < Parameters.length; j++) {
              if (parameters[j].length > 0) {
              /* If we are not the first parameter, add an ampersand */
                if (query.length != 0) {
                  query += "&";
                }
                query += Parameters[j].Name;
                query += "=";
                query += parameters[j];
              }
            }

            var url = action;
                
            if (Execute.Method.toLowerCase() == "post") {
              var ios = Components.classes["@mozilla.org/network/io-service;1"]
                                  .getService(Components.interfaces.nsIIOService);

              var stringStream =  Components.classes["@mozilla.org/io/string-input-stream;1"]
                                            .createInstance(Components.interfaces.nsIStringInputStream);
              if ("data" in stringStream) // Gecko 1.9 or newer
                stringStream.data = query;
              else // 1.8 or older
                stringStream.setData(query, query.length);

              var postData = Components.classes["@mozilla.org/network/mime-input-stream;1"]
                                       .createInstance(Components.interfaces.nsIMIMEInputStream);
              if (Execute.Enctype) {
                postData.addHeader("Content-Type", Execute.Enctype);
              } else {
                postData.addHeader("Content-Type", "application/x-www-form-urlencoded");
              }
              if (Execute["Accept-charset"]) {
                postData.addHeader("Accept-Charset", Execute["Accept-charset"]);
              } else {
                postData.addHeader("Accept-Charset", "utf-8");
              }
              postData.addContentLength = true;
              postData.setData(stringStream);
              Operator.openLink(url, event, undefined, undefined, undefined, postData, undefined);
            } else {
              if (query.length > 0) {
                if (!action.match(/\?/)) {
                  url += "?";
                } else {
                  url += "&";
                }
                url += query;
              }
              Operator.openLink(url, event);
            }
          }
        };
        actionObject.doAction = doActionCallbackGenerator(Execute, Parameters);
      } else {
        /* other method like script */
      }
      actionObjects.push(actionObject);
    }
    return actionObjects;
  },
  
  /* This is the primary init function and it is called whenever the XUL for a window is initially loaded */
  /* It handles loading and initializing Microformats, as well as initializing prefs */
  /* It also adds the listeners so we can window load events */
  init: function init()
  {
    /* Set a variable if we are being accessed by options so we do less work */
    var options = false;
    if (window.location.href.match("operator_options")) {
      options = true;
    }
    /* Attempt to use the Microformats module if available (Firefox 3) */
//    if (Components.utils.import) {
//      try {
//        Components.utils.import("resource:///modules/Microformats.js");
//      } catch (ex) {
//        /* Unable to load system Microformats - use builtin */
//      }
//    }
    var objScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
    /* If we didn't get Microformats by import, load our own JS file */
    if (typeof(Microformats) == "undefined") {
      objScriptLoader.loadSubScript("chrome://operator/content/Microformats/Microformats.js");
    }
    /* xFolk is not a part of Firefox 3 */
    if (!Microformats.xFolk) {
      objScriptLoader.loadSubScript("chrome://operator/content/Microformats/xFolk.js");
    }
    /* Don't assume we have RDF */
    try {
      objScriptLoader.loadSubScript("chrome://operator/content/RDFa/rdfa.js");
      objScriptLoader.loadSubScript("chrome://operator/content/eRDF/eRDF.js");
    } catch (ex) {}
    /* Load the builtin semantic actions */
    objScriptLoader.loadSubScript("chrome://operator/content/SemanticActions/SemanticActions.js");

    if (!options) {
      /* Operator specific Microformats stuff */
      Microformats.hCard.icon = "chrome://operator/content/hCard.png";
      Microformats.hCalendar.icon = "chrome://operator/content/hCalendar.png";
      Microformats.geo.icon = "chrome://operator/content/geo.png";
      Microformats.tag.sort = true;

      /* Load the Operator UI elements */
      objScriptLoader.loadSubScript("chrome://operator/content/operator_toolbar.js");
      objScriptLoader.loadSubScript("chrome://operator/content/operator_statusbar.js");
      objScriptLoader.loadSubScript("chrome://operator/content/operator_toolbar_button.js");
      objScriptLoader.loadSubScript("chrome://operator/content/operator_urlbar_button.js");
//      objScriptLoader.loadSubScript("chrome://operator/content/operator_toolbar_buttons.js");
      objScriptLoader.loadSubScript("chrome://operator/content/operator_sidebar.js");
    }
    /* Get a bundle for the operator properties file */
    var bundleService = Components.classes["@mozilla.org/intl/stringbundle;1"].
                                   getService(Components.interfaces.nsIStringBundleService);
    this.languageBundle = bundleService.createBundle("chrome://operator/locale/operator.properties");

    /* Read the microformat descriptions from the language bundle */
    var i, j;
    for (i in Microformats)
    {
      try {
        Microformats[i].description = this.languageBundle.GetStringFromName(i + ".description");
      } catch (ex) {
      }
    }
    if (Components.interfaces.nsIEffectiveTLDService) {
      this.eTLDService = Components.classes["@mozilla.org/network/effective-tld-service;1"]
                                 .getService(Components.interfaces.nsIEffectiveTLDService);
    } else {
	  this.eTLDService = function(s) { return s;};
	}

    /* Setup the pref branch */
    this.prefBranch = Components.classes["@mozilla.org/preferences-service;1"].
                                 getService(Components.interfaces.nsIPrefService).
                                 getBranch("extensions.operator.");
    /* Check for prefs from Operator 0.6. If present, remove them */
    var prefBranchOld = Components.classes["@mozilla.org/preferences-service;1"].
                                   getService(Components.interfaces.nsIPrefService).
                                   getBranch("extensions.operator_toolbar.");
    var oldcount = { value: 0 };
    try {
      var prefArray = prefBranchOld.getChildList("", oldcount);
    } catch (ex) {
    }
    if (oldcount.value > 0) {
      prefBranchOld.deleteBranch("");
    }
    /* Look for a pre 0.8 preference. If present, reset the prefs */
    /* Pref migration just got to be too much. */
    try {
      this.prefBranch.getCharPref("microformat1");
      /* If we got here, we have old stuff */
      this.prefBranch.deleteBranch("");
    } catch (ex) {}
    var newcount = { value: 0 };
    try {
      this.prefBranch.getChildList("", newcount);
    } catch (ex) {
    }
    /* If we don't have any preferences, setup the default prefs */
    /* We do this before user scripts so defaults just contain our stuff */
    if (newcount.value < 3) {
      j = 1;
      for (i in Microformats) {
        if (i != "adr") {
          this.prefBranch.setCharPref("dataformat" + (j), i);
          j++;
        }
      }
      if ((typeof(RDFa) != "undefined") || (typeof(eRDF) != "undefined")) {
        this.prefBranch.setCharPref("dataformat" + (j), "RDF");
      }

/*      this.prefBranch.setCharPref("action1", "export_vcard");
      this.prefBranch.setCharPref("action2", "google_calendar");
      this.prefBranch.setCharPref("action3", "google_maps");
      this.prefBranch.setCharPref("action4", "flickr_search_tags");
      this.prefBranch.setCharPref("action5", "delicious_search_tags");
      this.prefBranch.setCharPref("action6", "technorati_search_tags"); */
    }
    
    var i=1;
    do {
      try {
        var dataformat = this.prefBranch.getCharPref("dataformat" + i);
      } catch (ex) {
        break;
      }
      if (dataformat) {
        Operator.dataformats[dataformat] = true;
      }
      i++;
    } while (1);

    var usdir = Components.classes["@mozilla.org/file/directory_service;1"].
                            getService(Components.interfaces.nsIProperties).
                            get("ProfD", Components.interfaces.nsILocalFile);
    usdir.append("operator");

    if (!usdir.exists()) {
      usdir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
    }
    if (usdir.isDirectory()) {
      /* Not going to support autocopying user scripts in Firefox 4 */
      if (Components.classes["@mozilla.org/extensions/manager;1"]) {
        /* If we have user scripts, copy them over */
        var extman = Components.classes["@mozilla.org/extensions/manager;1"]
                                        .getService(Components.interfaces.nsIExtensionManager);
        var appdir = extman.getInstallLocation("{95C9A302-8557-4052-91B7-2BB6BA33C885}")
                           .getItemLocation("{95C9A302-8557-4052-91B7-2BB6BA33C885}");
        appdir.append("userscripts");
        
        if (appdir.exists() && appdir.isDirectory()) {
          var e = appdir.directoryEntries;
          while (e.hasMoreElements()) {
            var f = e.getNext().QueryInterface(Components.interfaces.nsIFile);
            var splitpath = f.path.split(".");
            /* Only load JS files */
            if (splitpath[splitpath.length-1] == "js") {
              var oldfile = usdir.clone();
              oldfile.append(f.leafName);
              if (!oldfile.exists()) {
                f.copyTo(usdir, null);
              } else {
                /* If the files don't have the same size and date, ask about */
                /* overwriting */
                if ((f.fileSize != oldfile.fileSize) || (f.lastModifiedTime != oldfile.lastModifiedTime)) {
                  if (f.lastModifiedTime > oldfile.lastModifiedTime) {
                    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
                                                   getService(Components.interfaces.nsIPromptService);
                    var button = promptService.confirmEx(window, "",
                                                         this.languageBundle.formatStringFromName("overwriteUserScript.confirm", [f.leafName], 1),
                                                         promptService.BUTTON_TITLE_YES * promptService.BUTTON_POS_0 +
                                                         promptService.BUTTON_TITLE_NO * promptService.BUTTON_POS_1,
                                                         null, null, null, null, {});
    
                    if (button == 0) {
                      oldfile.remove(false);
                      f.copyTo(usdir, null);
                    }
                  }
                }
              }
            }
          }
          /* Remove the user scripts directory completely so they aren't asked again */
          try {
            appdir.remove(true);
          } catch (ex) {
          }
        }
      }
	  /* My idea of having people Component.utils.import Microformats.js was BAD */
	  function validUserScript(spec) {
		var ioService=Components.classes["@mozilla.org/network/io-service;1"]
		  .getService(Components.interfaces.nsIIOService);
		var scriptableStream=Components
		  .classes["@mozilla.org/scriptableinputstream;1"]
		  .getService(Components.interfaces.nsIScriptableInputStream);
         var channel=ioService.newChannel(spec,null,null);
		var input=channel.open();
		scriptableStream.init(input);
		var str=scriptableStream.read(input.available());
		scriptableStream.close();
		input.close();
		if (str.match("Components.utils.import")) {
		  return false;
		}
		return true;
	  }
      /* Load user scripts from the operator directory in the profile */
      var e = usdir.directoryEntries;
      var domParser = new DOMParser();
      while (e.hasMoreElements()) {
        var f = e.getNext().QueryInterface(Components.interfaces.nsIFile);
        var splitpath = f.path.split(".");
        if (splitpath[splitpath.length-1] == "js") {
          var fileHandler = Components.classes["@mozilla.org/network/io-service;1"].
                                       getService(Components.interfaces.nsIIOService).
                                       getProtocolHandler("file").
                                       QueryInterface(Components.interfaces.nsIFileProtocolHandler);
          try {
			if (validUserScript(fileHandler.getURLSpecFromFile(f))) {
              objScriptLoader.loadSubScript(fileHandler.getURLSpecFromFile(f));
			}
          } catch (ex) {
            alert("Unable to load " + f.leafName + "\n\n" + "(" + ex.message + ")");
          }
        } else if (splitpath[splitpath.length-1] == "xml") {
          var sourcefile = Components.classes["@mozilla.org/file/local;1"]
                                     .createInstance(Components.interfaces.nsILocalFile);
          sourcefile.initWithPath(f.path);

          var fileInStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                                       .createInstance(Components.interfaces.nsIFileInputStream);
          fileInStream.init(sourcefile, 0x01, 0644, false);
          var doc = domParser.parseFromStream(fileInStream, "UTF-8",
                                              sourcefile.fileSize,
                                             "text/xml");
          fileInStream.close();

          var actionObjects = Operator.actionObjectsFromDocument(doc);
          for (let i = 0; i < actionObjects.length; i++) {
            SemanticActions.add(actionObjects[i].category + "_" + i + "_" + actionObjects[i].host, actionObjects[i]);
          }

        }
      }
    }
    
    /* Duplicate the semantic actions in our own actions array */
    for (i in SemanticActions) {
      Operator.actions.add(i, SemanticActions[i]);
    }

	try {
	  var pref = this.prefBranch.getCharPref("actions.disabled");
	  var disabledActions = pref.split(',');
	  for (var i=0; i < disabledActions.length; i++) {
		Operator.actions[disabledActions[i]].disabled = true;
	  }
	} catch (ex) {
	}


    /* This is to allow translation of actions. Basically we get the default */
    /* locale, and if a description exists for that locale, use it. */
    /* We also support the old way where description is not an array */
    var curLocale = "en-US";
    try {
      curLocale = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefService)
                            .getBranch(null)
                            .getCharPref("general.useragent.locale");
    }
    catch (e) {}

    for (i in Operator.actions)
    {
      try {
        Operator.actions[i].description = this.languageBundle.GetStringFromName(i + ".description");
      } catch (ex) {
        if (Operator.actions[i].description) {
          if (Operator.actions[i].description[curLocale]) {
            Operator.actions[i].description = Operator.actions[i].description[curLocale];
          }
        }
      }
    }
    

    /* Initialize our default values from prefs */ 
    try {
      this.debug = this.prefBranch.getBoolPref("debug");
    } catch (ex) {}
    try {
      this.release = this.prefBranch.getBoolPref("release");
    } catch (ex) {}
    try {
      this.useDescriptiveNames = this.prefBranch.getBoolPref("useDescriptiveNames");
    } catch (ex) {}
    try {
      this.highlightMicroformats = this.prefBranch.getBoolPref("highlightMicroformats");
    } catch (ex) {}
    try {
      this.removeDuplicates = this.prefBranch.getBoolPref("removeDuplicates");
    } catch (ex) {}
    try {
      this.showHidden = this.prefBranch.getBoolPref("showHidden");
    } catch (ex) {}
    try {
      this.allowInvalidTags = this.prefBranch.getBoolPref("allowInvalidTags");
    } catch (ex) {}
    try {
      this.observeDOMAttrModified = this.prefBranch.getBoolPref("observeDOMAttrModified");
    } catch (ex) {}
    try {
      this.upcomingBugFixed = this.prefBranch.getBoolPref("upcomingBugFixed");
    } catch (ex) {}
    //try {
    //  this.view = this.prefBranch.getIntPref("view");
    //} catch (ex) {}
    try {
      this.statusbar = this.prefBranch.getBoolPref("statusbar");
    } catch (ex) {}
    try {
      this.urlbar = this.prefBranch.getBoolPref("urlbar");
    } catch (ex) {}
    try {
      this.autohide = this.prefBranch.getBoolPref("autohide");
    } catch (ex) {}
    try {
      this.useShortDescriptions = this.prefBranch.getBoolPref("useShortDescriptions");
    } catch (ex) {}

    if (options) {
      return;
    }

    var i=1;
	do {
	  try {
		action = this.prefBranch.getCharPref("action" + i);
	  } catch (ex) {
		break;
	  }
	  i++;
	} while (1);

    /* Attach listeners for page load */ 
    window.addEventListener("load", this.startup, false);
    window.addEventListener("unload", this.shutdown, false);
    window.addEventListener("operator-sidebar-load", Operator_Sidebar.populate, false);
	  function operatorEvent(event) {
    function insertTBButton(buttonID, beforeID) {
	  var navBar = document.getElementById("nav-bar");
	  var before = document.getElementById(beforeID);
	  var newSet;
	  if (navBar && before) {
		var newButton = navBar.insertItem(buttonID, before);
		if (navBar.hasAttribute("currentset") && 
		    (navBar.getAttribute("currentset").indexOf(buttonID) == -1)) {
		  newSet = navBar.getAttribute("currentset");
		} else {
		  newSet = navBar.getAttribute('defaultset');
		}
		newSet = newSet.replace("," + beforeID, "," + buttonID + "," + beforeID);
		navBar.setAttribute('currentset', newSet);
		document.persist('nav-bar', 'currentset');
	  }
	  if (!newButton || !navBar || !before) {
	    window.setTimeout(insertTBButton, 500, buttonID, beforeID);
	  }
	}

		var href;
		if (event.target.ownerDocument) {
		  href = event.target.ownerDocument.location.href;
		} else {
		  href = event.target.location.href;
		}
		if (href == "http://kaply.com/addons/operator/install/") {
		  if (event.target.id) {
			switch (event.target.id) {
			  case "toolbar":
				if (event.target.checked) {
				  Operator_Toolbar.show();
				} else {
				  Operator_Toolbar.hide();
				}
				break;
			  case "toolbarbutton":
				if (event.target.checked) {
				  insertTBButton("operator-toolbar-button", "urlbar-container");
				  event.target.disabled = true;
				}
			  case "urlbar":
				Operator.urlbar = event.target.checked;
				Operator.prefBranch.setBoolPref("urlbar", event.target.checked);
				if (Operator.urlbar) {
				  Operator_URLbarButton.enable();
				} else {
				  Operator_URLbarButton.disable();
				}
				break;
			  case "statusbar":
				Operator.statusbar = event.target.checked;
				Operator.prefBranch.setBoolPref("statusbar", event.target.checked);
				if (Operator.statusbar) {
				  Operator_Statusbar.show();
				} else {
				  Operator_Statusbar.hide();
				}
				break;
			}
		  } else {
			event.target.getElementById("statusbar").checked = Operator.statusbar;
			event.target.getElementById("toolbar").checked = !document.getElementById("operator-toolbar").collapsed;
			event.target.getElementById("urlbar").checked = Operator.urlbar;
			event.target.getElementById("toolbarbutton").checked = Operator_ToolbarButton.isVisible();
			if (Operator_ToolbarButton.isVisible()) {
			  event.target.getElementById("toolbarbutton").disabled = true;
			}

		  }
		}
	  }
	window.addEventListener("OperatorEvent", operatorEvent, false, true);
  },
  /* This function handles the window startup piece, initializing the UI and preferences */
  startup: function startup()
  {
    window.removeEventListener("load", startup, false);
	firstrun = Operator.prefBranch.getBoolPref("firstrun");

	/* get installed version */
//    var em = Components.classes["@mozilla.org/extensions/manager;1"]
//                       .getService(Components.interfaces.nsIExtensionManager);

    var curVersion = "0.0.0";

	if (firstrun) {
      window.setTimeout(function(){
        gBrowser.selectedTab = gBrowser.addTab("http://kaply.com/addons/operator/install/");
      }, 1000);
	  Operator.prefBranch.setBoolPref("firstrun", false);
	  Operator.prefBranch.setCharPref("installedVersion", curVersion);
	} else {
	  var installedVersion = Operator.prefBranch.getCharPref("installedVersion");
	  if (curVersion > installedVersion) {
        window.setTimeout(function(){
          gBrowser.selectedTab = gBrowser.addTab("http://kaply.com/addons/operator/upgrade");
        }, 1000);
  	    Operator.prefBranch.setCharPref("installedVersion", curVersion);
	  }
	}

    /* Add an observer so we see changes to prefs */
    Operator.prefBranch.QueryInterface(Components.interfaces.nsIPrefBranch2);
    Operator.prefBranch.addObserver("", Operator, false);

    /* Display the status bar icon if it is turned on in prefs */
    if (Operator.statusbar) {
      Operator_Statusbar.show();
    } else {
      Operator_Statusbar.hide();
    }
    /* Create the toolbar. We have to do this even if the toolbar is invisible, since */
    /* A user might choose to display the toolbar at anytime and there is no notification */
    Operator_Toolbar.create();
    /* Event listeners for showing and hiding page content */
    window.addEventListener("pageshow", Operator.onPageShow, false);
    window.addEventListener("pagehide", Operator.onPageHide, false);
    /* Event listener for when you switch tabs */
    getBrowser().tabContainer.addEventListener("select", Operator.onTabChanged, false);
    /* Event listener so we can modify the page context menu */
    var menu = document.getElementById("contentAreaContextMenu");
    menu.addEventListener("popupshowing", Operator.contextPopupShowing, false);
  },
  /* This function handles the window closing piece, removing listeners and observers */
  shutdown: function shutdown()
  {
    /* Remove pref observer */
    Operator.prefBranch.removeObserver("", Operator);
    /* Remove page show and hide observers */
    window.removeEventListener("pageshow", Operator.onPageShow, false);
    window.removeEventListener("pagehide", Operator.onPageHide, false);
    /* Remove listener for switching tabs */
    getBrowser().tabContainer.removeEventListener("select", Operator.onTabChanged, false);
    /* Remove page context menu listener */
    var menu = document.getElementById("contentAreaContextMenu");
    menu.removeEventListener("popupshowing", Operator.contextPopupShowing, false);
  },
  /* This function looks for preference changes and updates our internal pref */
  /* and UI if they happen */
  observe: function observe(subject, topic, data)
  {
    /* Bail if it isn't a pref change */
    if (topic != "nsPref:changed")
    {
      return;
    }
    /* batchPref changes is set to true before options starts updating prefs */
    /* Then it is set to false at the end */
    if (data == "batchPrefChanges") {
        this.batchPrefChanges = this.prefBranch.getBoolPref("batchPrefChanges");
    }
    if (data == "debug") {
      this.debug = this.prefBranch.getBoolPref("debug");
    }
    if (data == "release") {
      this.release = this.prefBranch.getBoolPref("release");
    }
    if (data == "useDescriptiveNames") {
      this.useDescriptiveNames = this.prefBranch.getBoolPref("useDescriptiveNames");
    }
    if (data == "removeDuplicates") {
      this.removeDuplicates = this.prefBranch.getBoolPref("removeDuplicates");
    }
    if (data == "showHidden") {
      this.showHidden = this.prefBranch.getBoolPref("showHidden");
    }
    if (data == "allowInvalidTags") {
      this.allowInvalidTags = this.prefBranch.getBoolPref("allowInvalidTags");
    }
    if (data == "observeDOMAttrModified") {
      this.observeDOMAttrModified = this.prefBranch.getBoolPref("observeDOMAttrModified");
    }
    if (data == "upcomingBugFixed") {
      this.upcomingBugFixed = this.prefBranch.getBoolPref("upcomingBugFixed");
    }
    if (data == "highlightMicroformats") {
      this.highlightMicroformats = this.prefBranch.getBoolPref("highlightMicroformats");
      /* If we had a highlighted element, reset it */
      if (this.highlightedElement) {
        this.highlightedElement.style.outline = this.highlightedElementOutlineStyle;
        this.highlightedElement = null;
      }
    }
    //if (data == "view") {
    //  this.view = this.prefBranch.getIntPref("view");
    //}
    if (data == "useShortDescriptions") {
      this.useShortDescriptions = this.prefBranch.getBoolPref("useShortDescriptions");
    }
    if (data == "urlbar") {
      this.urlbar = this.prefBranch.getBoolPref("urlbar");
    }
    if (data == "autohide") {
      this.autohide = this.prefBranch.getBoolPref("autohide");
	  if (this.autohide == false) {
        Operator_Toolbar.show();
	  }
    }
    if (data == "statusbar") {
      this.statusbar = this.prefBranch.getBoolPref("statusbar");
      if (this.statusbar) {
        Operator_Statusbar.show();
      } else {
        Operator_Statusbar.hide();
      }
      return;
    }
    if (data.match("dataformat")) {
      Operator.dataformats = {};
      var i=1;
      do {
        try {
          var dataformat = this.prefBranch.getCharPref("dataformat" + i);
        } catch (ex) {
          break;
        }
        if (dataformat) {
          Operator.dataformats[dataformat] = true;
        }
        i++;
      } while (1);
    }
    if (data == "actions.disabled") {
	  var disabledActions =  this.prefBranch.getCharPref("actions.disabled");
	  var disabledActionsTemp = disabledActions.split(',');
      var foo = []; 
	  for (var i=0; i < disabledActionsTemp.length; i++) {
		foo[disabledActionsTemp[i]] = true;
		
	  }
	  
      for (i in Operator.actions) {
		if (foo[i]) {
		  Operator.console_message("disabling" + i);
		  Operator.actions[i].disabled = true;
		} else {
		  Operator.actions[i].disabled = false;
		}
	  }
    }

    /* If batchPrefChanges is false, recreate the toolbar and reprocess */
    /* microformats */
    if (!this.batchPrefChanges) {
      Operator_Toolbar.create();
      Operator.processSemanticData();
    }
  },

  openLink: function openLink(url, event) {
	if (url.indexOf("file://") == 0) {
	  	openUILink(url, event);
	} else {
	  openUILinkIn(url, "tab");
	}

  },

  /* This is a closure used to highlight DOM nodes when a microformat is */
  /* selected in the menu */
  highlightCallbackGenerator: function highlightCallbackGenerator(item)
  {
    return function(event) {
      if (Operator.highlightDOMNode(item)) {
        item.scrollIntoView(false);
      }
    };
  },

  /* This is a closure used to execute an action */
  actionCallbackGenerator: function actionCallbackGenerator(semanticObject, semanticObjectType, semanticAction, propertyIndex)
  {
    return function(event) {
      var url;
      url = SemanticActions[semanticAction].doAction(semanticObject, semanticObjectType, propertyIndex, event)
      if ((url) && (url != true)) {
        Operator.openLink(url, event);
      }
    };
  },
  /* This is a closure used to execute a do all action */
  actionAllCallbackGenerator: function actionAllCallbackGenerator(semanticArrays, semanticAction, semanticObjectType, propertyIndex)
  {
    return function(event) {
      var url;
      url = SemanticActions[semanticAction].doActionAll(semanticArrays, semanticObjectType)
      if ((url) && (url != true)) {
        Operator.openLink(url, event);
      }

    };
  },
  /* This is a closure specifically to handle middle click so we can do interesting stuff */
  clickCallbackGenerator: function clickCallbackGenerator(semanticObject, semanticObjectType, semanticAction, propertyIndex)
  {
    return function(event) {
      /* This is for middle click only */
      if (event.button == 1) {
        if (event.target.getAttribute("disabled") != "true") {
          var url;
          url = SemanticActions[semanticAction].doAction(semanticObject, semanticObjectType, propertyIndex, event)
          if ((url) && (url != true)) {
            Operator.openLink(url, event);
          }
          closeMenus(event.target);
        }
      }
    };
  },
  /* This is a closure specifically to handle middle click for do all actions */
  /* so we can do interesting stuff */
  clickAllCallbackGenerator: function clickAllCallbackGenerator(semanticArrays, semanticAction, semanticObjectType)
  {
    return function(event) {
      /* This is for middle click only */
      if (event.button == 1) {
        if (event.target.getAttribute("disabled") != "true") {
          var url;
          url = SemanticActions[semanticAction].doActionAll(semanticArrays, semanticObjectType)
          if ((url) && (url != true)) {
            Operator.openLink(url, event);
          }
          closeMenus(event.target);
        }
      }
    };
  },

  /* This is a closure used when there is a microformats error. It displays */
  /* The error/debug dialog */
  errorCallbackGenerator: function errorCallbackGenerator(semanticObject, semanticObjectType)
  {
    return function(event) {
      Operator.error(semanticObject, semanticObjectType);
    };
  },
  /* This function sorts semantic object nodes and also removes duplicates */
  sortUnique: function (semanticObjects, sort, unique)
  {
    if (semanticObjects.length == 1) {
      return semanticObjects;
    }
    if (unique) {
      var serializer = new XMLSerializer();
      for (var i=0; i < semanticObjects.length; i++) {
        for (var j=i+1; j < semanticObjects.length; j++) {
          /* If we aren't already a duplicate, check to see if */
          /* j is the same as i */
          if (!semanticObjects[j].duplicate) {
            if (semanticObjects[j].displayName && (semanticObjects[j].displayName == semanticObjects[i].displayName)) {
              if ((Microformats[semanticObjects[i].semanticType].className) && (semanticObjects[i].node.innerHTML == semanticObjects[j].node.innerHTML)) {
                  semanticObjects[j].duplicate = true;
              } else if (serializer.serializeToString(semanticObjects[i].node) == serializer.serializeToString(semanticObjects[j].node)) {
                semanticObjects[j].duplicate = true;
              } else if (Operator.areEqualObjects(semanticObjects[j], semanticObjects[i])) {
                semanticObjects[j].duplicate = true;
              }
            }
          }
        }
      }
    }
    if (sort) {
      return semanticObjects.sort(
        function (a,b) {
          if (!a.displayName || !b.displayName) {
            if (!a.displayName && !b.displayName) {
              return 0;
            }
            if (!a.displayName) {
              return -1;
            }
            if (!b.displayName) {
              return 1;
            }
          }
          if (a.displayName.toLowerCase() < b.displayName.toLowerCase()) {
            return -1;
          }
          if (a.displayName.toLowerCase() > b.displayName.toLowerCase()) {
            return 1;
          }
          return 0;
        }
      );
    }
    return semanticObjects;
  },
  /* Build the menu for data formats (not actions) */
  buildMenu: function buildMenu(semanticObjects, semanticObjectType, semanticAction)
  {
    /* Go ahead and set the displayName instead of querying it each time */
    /* Major performance win */
    for (var i=0; i < semanticObjects.length; i++) {
      if (Operator.allowInvalidTags && (semanticObjectType == "tag")) {
        semanticObjects[i].displayName = semanticObjects[i].text;
        delete(semanticObjects[i].tag);
        semanticObjects[i].tag = semanticObjects[i].text;
      } else {
        semanticObjects[i].displayName = semanticObjects[i].toString();
      }
	  /* Hide RDF without labels */
	  if (semanticObjectType == "RDF") {
		if (semanticObjects[i].displayName.match("_:") && !this.debug) {
		  semanticObjects[i].duplicate = true;
		}
	  }
    }
    
    /* Sort and remove duplicates */
    if ((Microformats[semanticObjectType]) && Microformats[semanticObjectType].sort) {
      semanticObjects = Operator.sortUnique(semanticObjects, true, Operator.removeDuplicates);
    } else {
      semanticObjects = Operator.sortUnique(semanticObjects, false, Operator.removeDuplicates);
    }
    var menu = null;

    var itemsadded = 0;
    var tempMenu;
    var menuitem;
    var j;
    for (j=0; j < semanticObjects.length; j++) {
      if (semanticObjects[j].duplicate) {
        continue;
      }
      if (semanticObjects[j].displayName || this.debug) {
        if (!menu) {
          menu = document.createElement("menupopup");
        }
        if ((this.view === 0) && (semanticObjects[j].displayName)) {
          tempMenu = document.createElement("menu");
        } else {
          tempMenu = document.createElement("menuitem");
        }
        tempMenu.store_onDOMMenuItemActive = this.highlightCallbackGenerator(semanticObjects[j].node);
        tempMenu.addEventListener("DOMMenuItemActive", tempMenu.store_onDOMMenuItemActive, false);
        if (semanticObjects[j].displayName) {
          tempMenu.label = semanticObjects[j].displayName;
        } else {
          tempMenu.label = "Invalid - select for more details";
        }
        tempMenu.setAttribute("label", tempMenu.label);
        if (!semanticObjects[j].displayName) {
          tempMenu.store_oncommand = this.errorCallbackGenerator(semanticObjects[j], semanticObjectType);
          tempMenu.addEventListener("command", tempMenu.store_oncommand, false);
          tempMenu.style.fontWeight = "bold";
          menu.error = true;
        } else {
          var submenu = document.createElement("menupopup");
          tempMenu.appendChild(submenu);
          tempMenu.store_onpopupshowing = this.popupShowing(semanticObjects[j], semanticObjectType);
          tempMenu.addEventListener("popupshowing", tempMenu.store_onpopupshowing, false);
        }
        menu.appendChild(tempMenu);
        itemsadded++;
        delete(semanticObjects[j].displayName);
      } else {
        /* XXX TODO Validate needs to be more generic? Or do we only call it in the microformat case? */
        var olderror = {};
        try {
          Microformats.parser.validate(semanticObjects[j].node, semanticObjectType, olderror);
          if (olderror.message) {
            Operator.console_message(olderror.message, Operator.lineNumberFromDOMNode(semanticObjects[j].node));
          }
        } catch (ex) {
          Operator.console_message(ex, Operator.lineNumberFromDOMNode(semanticObjects[j].node));
        }
      }
    }
    for (var i=0; i < semanticObjects.length; i++) {
      delete(semanticObjects[i].displayName);
    }

    
    return menu;
  },
  /* Function so we can delay load the action submenus for data format popups */
  popupShowing: function popupShowing(semanticObject, semanticObjectType)
  {
    return function(event) {
      if (event.target.childNodes.length == 0) {
        Operator.attachActions(event.target, semanticObject, semanticObjectType);
      }
    };
  },
  attachActions: function attachActions(parentmenu, semanticObject, semanticObjectType, popup)
  {
    var required;
    var plural;
    var menuitem;
    var submenu = parentmenu;
    var k, m;
    var addedAction = false;
    var required;
    var menupopup;
    for (k in Operator.actions) {
      if (Operator.actions[k].disabled ) {
        continue;
      }
      if (!Operator.actions[k].doAction ) {
        continue;
      }
      if (!Operator.actions[k].scope) {
        continue;
      }
      if (!Operator.actions[k].scope.semantic[semanticObjectType]) {
        continue;
      }
      required = null;
      plural = false;
      if ((Operator.actions[k].scope.semantic[semanticObjectType] != semanticObjectType) &&
        Microformats[semanticObjectType] && !Operator.actions[k].scope.semantic[semanticObjectType].custom) { 
        var reqprop = Operator.actions[k].scope.semantic[semanticObjectType];
        if (reqprop.indexOf(".") != -1) {
          var props = reqprop.split(".");
          if (semanticObject[props[0]]) {
            required = semanticObject[props[0]][props[1]];
            try {
              plural = Microformats[semanticObjectType].properties[props[0]][props[1]].plural;
            } catch (ex) {
              /* It's possible with nesting of microformat types to have no */
              /* in the actual microformats */
              plural = false;
            }
          }
        } else {
            required = semanticObject[reqprop];
            plural = Microformats[semanticObjectType].properties[reqprop].plural;
        }
        if (!required) {
          continue;
        }
      }
      if (Operator.actions[k].scope.url) {
		var host = Operator.eTLDService.getBaseDomainFromHost(content.document.location.host);
        if (!(Operator.actions[k].scope.url.match(host))) {
          continue;
        }
      }
      if (semanticObjectType == "RDF") {
        if ((semanticObject.$model.getProperty(semanticObject.$subject, Operator.actions[k].scope.semantic[semanticObjectType]["property"])).length == 0) {
          continue;
        } else {
          semanticObject.setDefaultNS(Operator.actions[k].scope.semantic[semanticObjectType]["defaultNS"]);
        }
      }
      var description;
      if (Operator.useShortDescriptions && Operator.actions[k].shortDescription) {
        description = Operator.actions[k].shortDescription;
      } else {
        description = Operator.actions[k].description;
      }
      if (!description) {
        description = k;
      }
      if (plural && (required.length > 1)) {
        var tempMenu;
        for (m=0; m < required.length; m++) {
          tempMenu = parentmenu.ownerDocument.createElement("menuitem");
          if (Operator.actions[k].getActionName) {
            tempMenu.label = Operator.actions[k].getActionName(semanticObject, semanticObjectType, m);
            if (tempMenu.label != undefined) {
              if (tempMenu.label.length > 1) {
                if (popup) {
                  tempMenu.label = description + " (" + tempMenu.label + ")";
                } else {
                  tempMenu.label = tempMenu.label;
                }
              } else {
                if (popup) {
                  tempMenu.label = description + " (" + required[m].toString() + ")";
                } else {
                  tempMenu.label = required[m].toString();
                }
              }
            }
          } else {
            if (popup) {
              tempMenu.label = description + " (" + required[m].toString() + ")";
            } else {
              tempMenu.label = required[m].toString();
            }
          }
          if (tempMenu.label) {
            tempMenu.setAttribute("label", tempMenu.label);
            if (required[m].semanticType) {
              tempMenu.store_oncommand = Operator.actionCallbackGenerator(required[m], required[m].semanticType, k);
            } else {
              tempMenu.store_oncommand = Operator.actionCallbackGenerator(semanticObject, semanticObjectType, k, m);
            }
            tempMenu.addEventListener("command", tempMenu.store_oncommand, false);
            if (required[m].semanticType) {
              tempMenu.store_onclick = Operator.clickCallbackGenerator(required[m], required[m].semanticType, k);
            } else {
              tempMenu.store_onclick = Operator.clickCallbackGenerator(semanticObject, semanticObjectType, k, m);
            }
            tempMenu.addEventListener("click", tempMenu.store_onclick, false);
            tempMenu.store_onDOMMenuItemActive = Operator.highlightCallbackGenerator(semanticObject.node);
            tempMenu.addEventListener("DOMMenuItemActive", tempMenu.store_onDOMMenuItemActive, false);
            if (popup) {
              submenu.appendChild(tempMenu);
            } else {
              if (!menupopup) {
                menupopup = parentmenu.ownerDocument.createElement("menupopup");
              }
              menupopup.appendChild(tempMenu);
            }
          }
        }
        if ((!popup) && (menupopup)) {
          menuitem = parentmenu.ownerDocument.createElement("menu");
          menuitem.label = description;
          menuitem.setAttribute("label", menuitem.label);
          menuitem.appendChild(menupopup);
        }
      } else {
        var label;
        if (Operator.actions[k].getActionName) {
          label = Operator.actions[k].getActionName(semanticObject, semanticObjectType);
          if (label != undefined) {
            if (label.length > 1) {
              label = description + " (" + label + ")";
            } else {
              label = description; 
            }
          }
        } else {
          label = description;
        }
        if (label) {
		  var req;
		  if (plural && required) {
			req = required[0];
		  } else {
			req = required;
		  }
          menuitem = parentmenu.ownerDocument.createElement("menuitem");
          if (req && req.semanticType) {
            menuitem.store_oncommand = Operator.actionCallbackGenerator(req, req.semanticType, k);
          } else {
            menuitem.store_oncommand = Operator.actionCallbackGenerator(semanticObject, semanticObjectType, k);
          }
          menuitem.addEventListener("command", menuitem.store_oncommand, false);
          if (req && req.semanticType) {
            menuitem.store_onclick = Operator.clickCallbackGenerator(req, req.semanticType, k);
          } else {
            menuitem.store_onclick = Operator.clickCallbackGenerator(semanticObject, semanticObjectType, k);
          }
          menuitem.addEventListener("click", menuitem.store_onclick, false);
          menuitem.label = label;
          menuitem.setAttribute("label", menuitem.label);
        }
      }
      if (menuitem) {
        submenu.appendChild(menuitem);
      }
      addedAction = true;
      menupopup = null;
      menuitem = null;
    }
    if (this.debug) {
      if (addedAction) {
        menuitem = parentmenu.ownerDocument.createElement("menuseparator");
        submenu.appendChild(menuitem);
      }
      menuitem = parentmenu.ownerDocument.createElement("menuitem");
      menuitem.label = Operator.languageBundle.GetStringFromName("debug.label");
      menuitem.setAttribute("label", menuitem.label);
      menuitem.store_oncommand = this.errorCallbackGenerator(semanticObject, semanticObjectType);
      menuitem.addEventListener("command", menuitem.store_oncommand, false);
      submenu.appendChild(menuitem);
    }
    if ((!addedAction) && (!this.debug)) {
      menuitem = parentmenu.ownerDocument.createElement("menuitem");
      menuitem.label = Operator.languageBundle.GetStringFromName("noActions.label");
      menuitem.setAttribute("label", menuitem.label);
      menuitem.setAttribute("disabled", true);
      submenu.appendChild(menuitem);
    }
  },
  /* This only works with microformats */
  contextPopupShowing: function contextPopupShowing(event) {
    gContextMenu.showItem("operator-menu-0", false);
    gContextMenu.showItem("operator-menu-1", false);
    gContextMenu.showItem("operator-menu-2", false);
    gContextMenu.showItem("operator-menu-3", false);
    gContextMenu.showItem("operator-menu-4", false);
    gContextMenu.showItem("operator-separator", false);
    var node = gContextMenu.target;
    var mfNode;
    if (Microformats.isMicroformat(node)) {
      mfNode = node;
    } else {
      mfNode = Microformats.getParent(node);
    }
    var curmenu = 0;
    /* Loop through node and all parent nodes to get all microformat */
    /* for ancestore chain */
    while (mfNode) {
      var mfNameString = Microformats.getNamesFromNode(mfNode);
      var mfNames = mfNameString.split(" ");
      var i;
      var actionmenu;
      var shown_separator = false;
      /* Loop through names for this given mfnode and handle each mf */
      for (i=0; i < mfNames.length; i++) {
        if (!Operator.dataformats[mfNames[i]]) {
          continue;
        }
        if (!shown_separator) {
          gContextMenu.showItem("operator-separator", true);
        }
        gContextMenu.showItem("operator-menu-" + curmenu, true);
        var menupopup = document.getElementById("operator-menupopup-" + curmenu);
        for(var j=menupopup.childNodes.length - 1; j>=0; j--) {
          menupopup.removeChild(menupopup.childNodes.item(j));
        }
        var menuitem = document.getElementById("operator-menu-" + curmenu);
        actionmenu = document.createElement("menupopup");
        curmenu++;
        if (Microformats[mfNames[i]].description) {
          menuitem.label = "Operator " + Microformats[mfNames[i]].description;
        } else {
          menuitem.label = "Operator " + mfNames[i];
        }
        menuitem.setAttribute("label", menuitem.label);
        Operator.attachActions(menupopup, new Microformats[mfNames[i]].mfObject(mfNode), mfNames[i], true);
      }
      mfNode = Microformats.getParent(mfNode);
    }
  },
  highlightDOMNode: function highlightDOMNode(node)
  {
    if (Operator.highlightMicroformats) {
      if (node) {
        if (Operator.highlightedElement != node) {
          if (Operator.highlightedElement) {
            Operator.highlightedElement.style.outline = this.highlightedElementOutlineStyle;
          }
          Operator.highlightedElement = node;
          Operator.highlightedElementOutlineStyle = node.style.outline;
          node.style.outline = "black solid medium";
        }
      } else {
        if (Operator.highlightedElement) {
          Operator.highlightedElement.style.outline = this.highlightedElementOutlineStyle;
          Operator.highlightedElement = null;
        }
      }
      return true;
    } else {
      return false;
    }
  },
  /* This only works with microformats */
  mouseOver: function mouseOver(event) {
    var element = (event.target) ? event.target : event.srcElement;
    var mfNode;
    if (Microformats.isMicroformat(element)) {
      mfNode = element;
    } else {
      mfNode = Microformats.getParent(element);
    }
    if (mfNode) {
//      mfNode.style.cursor = "url(http://microformats.org/favicon.ico), pointer";
      Operator.highlightDOMNode(mfNode);
    } else {
      Operator.highlightDOMNode();
    }
  },
  processSemanticDataDelayed: function processSemanticDataDelayed(event)
  {
    if (event) {
      var target = event.target.ownerDocument ? event.target.ownerDocument : event.target;
      if (content.document != target) {
        return;
      }
    }
    /* Should we check to make sure the node involved is microformat related ? */
    if (Operator.timerID) {
      window.clearTimeout(Operator.timerID);
    }
    Operator.timerID = window.setTimeout(Operator.processSemanticData, 100);
  },
  onPageHide: function onPageHide(event) 
  {
    var target = event.target.ownerDocument ? event.target.ownerDocument : event.target;
    if (content && content.document == target) {
      Operator.disable();
    }
  },
  preprocessEvent: function preprocessEvent(event)
  {
    if ((event.target.nodeName.toLowerCase() == "style") || (event.target.nodeName.toLowerCase() == "script")) {
      return;
    }
    var target = event.target.ownerDocument ? event.target.ownerDocument : event.target;
    if (content.document != target) {
      return;
    }
    Operator.processSemanticDataDelayed();
  },
  onPageShow: function onPageShow(event) 
  {
    if (event.type == "pageshow") {
      var target = event.target.ownerDocument ? event.target.ownerDocument : event.target;
      /* Add listeners in the page show case. We don't need them in the */
      /* DOMContentLoaded case */
      target.addEventListener("mouseover", Operator.mouseOver, false);
      if (Operator.observeDOMAttrModified) {
        target.addEventListener("DOMNodeInserted", Operator.preprocessEvent, false);
        target.addEventListener("DOMNodeRemoved", Operator.preprocessEvent, false);
        target.addEventListener("DOMAttrModified", Operator.preprocessEvent, false);
      }
      /* Cannot do this check because it breaks frame navigation! */
//      if (content.document == target) {
        Operator.processSemanticDataDelayed();
//      }
    }
  },
  onTabChanged: function onTabChanged(event)
  {
    Operator.processSemanticData();
  },
  /* This function compares the strings in two objects to see if they are equal */
  areEqualObjects: function areEqualObjects(object1, object2)
  {
    if (!object1 || !object2) {
      return false;
    }
    if (object1.__count__ != object1.__count__) {
      return false;
    }
    for (var i in object1) {
      if (typeof(object1[i]) =="string") {
        if (object1[i] == object2[i]) {
          continue;
        }
      } else if (object1[i] instanceof Array) {
        if (Operator.areEqualObjects(object1[i], object2[i])) {
          continue;
        }
      } else {
        continue;
      }
      return false;
    }
    return true;
  },
  debug_alert: function debug_alert(text)
  {
    if (!Operator.release) {
      window.openDialog("chrome://operator/content/operator_debug.xul","alert","chrome,centerscreen,modal,resizable", "Alert", text);
    }
  },
  console_message: function console_message(text, line_number)
  {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"].
                                    getService(Components.interfaces.nsIConsoleService);
    var scriptError = Components.classes["@mozilla.org/scripterror;1"].
                                 createInstance(Components.interfaces.nsIScriptError);
    if (!line_number) {
      line_number = 0;
    }                             
    scriptError.init("Operator: " + text, content.document.location.href, null, line_number, 
                     null, 0, 0);
    consoleService.logMessage(scriptError);
  },
  lineNumberFromDOMNode: function lineNumberFromDOMNode(node)
  {
    var serializer = new XMLSerializer();
    var source = serializer.serializeToString(content.document);
//    this.debug_alert(source);
    var node_source = serializer.serializeToString(node);
    var offset = source.indexOf(node_source);
    var less_source =source.substring(0, offset);
    var lines = less_source.split("\n");
    return lines.length;
  },
  error: function error(semanticObject, semanticObjectType)
  {
    var serializer = new XMLSerializer();
    var xmlString;
    if (semanticObject.node) {
      xmlString = serializer.serializeToString(semanticObject.node);
    }
    var vcfical = null;
    var X2V = null;
    
    if (semanticObjectType == "hCard") {
      try {
        vcfical = SemanticActions.export_vcard.vCard(semanticObject);
      } catch (ex) {}
      X2V = semanticObject.node;
    }
    if (semanticObjectType == "hCalendar") {
      try {
        vcfical = SemanticActions.export_icalendar.iCalendar(semanticObject, true, true);
      } catch (ex) {}
      X2V = semanticObject.node;
    }
    
    var error;
    var olderror = {};
    /* XXX TODO Validate needs to be more generic? Or do we only call it in the microformat case? */
    if (semanticObjectType != "RDF") {
      try {
        Microformats.parser.validate(semanticObject.node, semanticObjectType, olderror);
        if (olderror.message) {
          error = olderror.message;
        }
      } catch (ex) {
        error = ex;
      }
    }

    /* XXX TODO cross semantic validation */
    var dump;
    if (semanticObject.debug) {
      dump = semanticObject.debug(semanticObject);
    }

    window.openDialog("chrome://operator/content/operator_debug.xul","debug","chrome,centerscreen,resizable",
                      semanticObjectType,
                      error,
                      dump,
                      xmlString,
                      vcfical,
                      X2V);
  },
  getSemanticData: function getSemanticData(window, semanticArrays)
  {
    if (window && window.frames.length > 0) {
      for (var i=0; i < window.frames.length; i++) {
        Operator.getSemanticData(window.frames[i], semanticArrays);
      }
    }
    try {
      if(RDFa.hasRDF(window.document)) {
        if (!semanticArrays["RDF"]) {
          semanticArrays["RDF"] = [];
        }
        /* Put model in the semanticArray (RDFa) */
        semanticArrays["RDF"].push(RDFa.parse(window.document));
        
      }
      if(eRDF.hasRDF(window.document)) {
        if (!semanticArrays["RDF"]) {
          semanticArrays["RDF"] = [];
        }
        var eRDF_model = new RDFa.Model();
        var eRDF_parser = eRDF.parser(window.document);
        //smush on owl:sameAs property
        eRDF_parser.do_owlSameAs();
        var triples = eRDF_parser.get_triples();
        for (var i=0; i < triples.length; i++)
        {
             var triple = triples[i];
             if(triple.o_type=='literal')
             {
                 eRDF_model.addLiteral(triple.s,triple.p,triple.o);
             }
             else
             {
                 eRDF_model.addResource(triple.s,triple.p,triple.o);
             }
        };
        if (triples.length >0) {
          semanticArrays["RDF"].push(eRDF_model);
        }
      }
    } catch (ex) {}
  },
  disable: function disableOperator()
  {
    /* Clear all the existing data and disable everything */
    Operator_Toolbar.clearPopups();
    Operator_Toolbar.disable();
    Operator_Statusbar.clearPopup();
    Operator_Statusbar.disable();
    Operator_ToolbarButton.clearPopup();
    Operator_ToolbarButton.disable();
    Operator_URLbarButton.clearPopup();
    Operator_URLbarButton.disable();
    Operator_Sidebar.clear();
  },
  /* This is the heavy lifter for Operator. It goes through the document
     looking for semantic data and creates the menus and buttons */
  processSemanticData: function processSemanticData()
  {
    if (!Operator.updateMenus) {
      Operator.processSemanticDataDelayed();
      return;
    }
//    Operator.console_message("processSemanticData called");
    /* Reset the timer we're using to batch processing */
    Operator.timerID = null;

    Operator.disable();

    /* Get all semantic data from the web page */
    var semanticArrays = [];
    var haveSemanticData;
    for (i in Operator.dataformats) {
      if (Microformats[i]) {
        semanticArrays[i] = Microformats.get(i, content.document,
                                             {showHidden: Operator.showHidden,
                                             debug: Operator.debug});
      } 
    }
    Operator.getSemanticData(content, semanticArrays);
    for (let i in semanticArrays) {
      if (semanticArrays[i].length > 0) {
        haveSemanticData = true;
      }
    }
    if (!haveSemanticData) {
      Operator_Sidebar.populate();
      if (Operator.autohide) {
        Operator_Toolbar.hide();
      }
      return;
    }
    if (Operator.urlbar) {
      Operator_URLbarButton.enable();
    }


/* check for rel-service link tags */
   var dochead = content.document.getElementsByTagName("head")[0];
   if (dochead) {
   var links = dochead.getElementsByTagName("link");
   for (let i=0; i < links.length; i++) {
     if ((links[i].getAttribute("rel") == "service") &&
         (links[i].getAttribute("type") == "application/openservicedescription+xml")) {
      var file = Components.classes["@mozilla.org/file/directory_service;1"].
                            getService(Components.interfaces.nsIProperties).
                            get("TmpD", Components.interfaces.nsIFile);
          
      var ios = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
                          
      var uri = ios.newURI(links[i].getAttribute("href"), null, ios.newURI(content.document.location.href, null, null));
      /* Need URL to get leafName */
      uri.QueryInterface(Components.interfaces.nsIURL);
      file.append(uri.fileName);
      try {
        file.remove(false);                         
      } catch (ex) {
      }
      var channel = ios.newChannelFromURI(uri);
      var downloader =
        Components.classes["@mozilla.org/network/downloader;1"]
                  .createInstance(Components.interfaces.nsIDownloader);
      var listener = {
        onDownloadComplete: function(downloader, request, ctxt, status, result) {
          /* Need result as an nsiFile */
          result.QueryInterface(Components.interfaces.nsIFile);
          var fileInStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                                       .createInstance(Components.interfaces.nsIFileInputStream);
          fileInStream.init(result, 0x01, 0644, false);
          var domParser = new DOMParser();
          var doc = domParser.parseFromStream(fileInStream, "UTF-8",
                                              result.fileSize,
                                             "text/xml");
          fileInStream.close();

          var actionObjects = Operator.actionObjectsFromDocument(doc);
          for (let i = 0; i < actionObjects.length; i++) {
			actionObjects[i].scope.url = "http://" + Operator.eTLDService.getBaseDomainFromHost(content.document.location.host);  
            SemanticActions.add(actionObjects[i].category + "_" + i + "_" + actionObjects[i].host, actionObjects[i]);
            if (!Operator.actions[actionObjects[i].category + "_" + i + "_" + actionObjects[i].host]) {
              Operator.actions.add(actionObjects[i].category + "_" + i + "_" + actionObjects[i].host, actionObjects[i], true);
            }
          }
        }
      }
      downloader.init(listener,file);
      channel.asyncOpen(downloader, null);
    }
   }
   }
 
    var i, j, k, m;
    var popup, menu, tempMenu, action;

    /* Actions */
    //if (Operator.view == 1) {
    //  /* Enumerate through all the prefed actions */
    //  /* For each action, enumerate through microformats it recognizes (based on the semantic array) */
    //  /* If it is an understood microformat, check for requires and display/enable/disable item */
    //  i = 1;
    //  var addedAction;
    //  do {
    //    addedAction = false;
    //    try {
    //      action = Operator.prefBranch.getCharPref("action" + i);
    //    } catch (ex) {
    //      break;
    //    }
    //
    //    if (Operator.actions[action].doAction && Operator.actions[action].scope) {
    //      for (j in Operator.actions[action].scope.semantic) {
    //        if (semanticArrays[j] && semanticArrays[j].length > 0) {
    //          var objectArray;
    //          if (j == "RDF") {
    //            /* Fill in objectArray by asking model for property */
    //            /* We actually need to loop through all RDFa models */
    //            /* and concatenate into one object array */
    //            objectArray = semanticArrays[j][0].getObjectsWithProperty(Operator.actions[action].scope.semantic[j]["property"],
    //                                                                      Operator.actions[action].scope.semantic[j]["defaultNS"]); 
    //          } else {
    //            if ((Microformats[j]) && Microformats[j].sort) {
    //              objectArray = Operator.sortUnique(semanticArrays[j], true, Operator.removeDuplicates);
    //            } else {
    //              objectArray = Operator.sortUnique(semanticArrays[j], false, Operator.removeDuplicates);
    //            }
    //          }
    //          var required;
    //          var plural = false;
    //          for (k=0; k < objectArray.length; k++) {
    //            /* Here we know we have objects that will work with this action */
    //            /* Create a menu that corresponds to the action? */
    //            /* Or postpone the creation until we are sure we have the first one? */
    //            required = null;
    //            if ((Operator.actions[action].scope.semantic[j] != j) && (j != "RDF")) {
    //              var reqprop = Operator.actions[action].scope.semantic[j]
    //              if (reqprop.indexOf(".") != -1) {
    //                var props = reqprop.split(".");
    //                if (objectArray[k][props[0]]) {
    //                  try {
    //                    plural = Microformats[j].properties[props[0]][props[1]].plural;
    //                  } catch (ex) {
    //                    /* It's possible with nesting of microformat types to have no */
    //                    /* in the actual microformats */
    //                    plural = false;
    //                  }
    //                }
    //              } else {
    //                required = objectArray[k][reqprop];
    //                plural = Microformats[j].properties[reqprop].plural;
    //              }
    //              if (!required) {
    //                continue;
    //              }
    //            }
    //            if (!menu) {
    //              menu = document.createElement("menupopup");
    //            }
    //            if (objectArray[k].toString()) {
    //              if (plural && (required.length > 1)) {
    //                for (m=0; m < required.length; m++) {
    //                  tempMenu = document.createElement("menuitem");
    //                  if (Operator.actions[action].getActionName) {
    //                    tempMenu.label = Operator.actions[action].getActionName(objectArray[k], j, m);
    //                    if (tempMenu.label != undefined) {
    //                      if (tempMenu.label.length == 0) {
    //                        tempMenu.label = objectArray[k].toString();
    //                      } else {
    //                        tempMenu.label = objectArray[k].toString() + " (" + tempMenu.label + ")";
    //                      }
    //                    }
    //                  } else {
    //                    tempMenu.label = objectArray[k].toString();
    //                  }
    //                  if (tempMenu.label) {
    //                    tempMenu.setAttribute("label", tempMenu.label);
    //                    tempMenu.store_oncommand = Operator.actionCallbackGenerator(objectArray[k], j, action, m);
    //                    tempMenu.addEventListener("command", tempMenu.store_oncommand, false);
    //                    tempMenu.store_onclick = Operator.clickCallbackGenerator(objectArray[k], j, action, m);
    //                    tempMenu.addEventListener("click", tempMenu.store_onclick, false);
    //                    tempMenu.store_onDOMMenuItemActive = Operator.highlightCallbackGenerator(objectArray[k].node);
    //                    tempMenu.addEventListener("DOMMenuItemActive", tempMenu.store_onDOMMenuItemActive, false);
    //                    menu.appendChild(tempMenu);
    //                    addedAction = true;
    //                  }
    //                }
    //                tempMenu = null;
    //              } else {
    //                var label;
    //                if (Operator.actions[action].getActionName) {
    //                  label = Operator.actions[action].getActionName(objectArray[k], j);
    //                  if (label != undefined) {
    //                    if (label.length == 0) {
    //                      label = objectArray[k].toString();
    //                    }
    //                  }
    //                } else {
    //                  label = objectArray[k].toString();
    //                }
    //                if (label) {
    //                  tempMenu = document.createElement("menuitem");
    //                  tempMenu.label = label;
    //                  tempMenu.setAttribute("label", tempMenu.label);
    //                  tempMenu.store_oncommand = Operator.actionCallbackGenerator(objectArray[k], j, action);
    //                  tempMenu.addEventListener("command", tempMenu.store_oncommand, false);
    //                  tempMenu.store_onclick = Operator.clickCallbackGenerator(objectArray[k], j, action);
    //                  tempMenu.addEventListener("click", tempMenu.store_onclick, false);
    //                  addedAction = true;
    //                }
    //              }
    //            } else if (Operator.debug) {
    //              tempMenu = document.createElement("menuitem");
    //              /* L10N */
    //              tempMenu.label = Operator.languageBundle.GetStringFromName("invalid.label");;
    //              tempMenu.setAttribute("label", tempMenu.label);
    //              tempMenu.store_oncommand = Operator.errorCallbackGenerator(objectArray[k], j);
    //              tempMenu.addEventListener("command", tempMenu.store_oncommand, false);
    //              tempMenu.style.fontWeight = "bold";
    //              menu.error = true;
    //            }
    //            if (tempMenu) {
    //              tempMenu.store_onDOMMenuItemActive = Operator.highlightCallbackGenerator(objectArray[k].node);
    //              tempMenu.addEventListener("DOMMenuItemActive", tempMenu.store_onDOMMenuItemActive, false);
    //              menu.appendChild(tempMenu);
    //            }
    //          }
    //        }
    //      }
    //    }
    //    if (Operator.actions[action].doActionAll) {
    //      var showActionAll = false;
    //      for (j in Operator.actions[action].scope.semantic) {
    //        if (semanticArrays[j] && semanticArrays[j].length > 0) {
    //          showActionAll = true;
    //        }
    //      }
    //      if (showActionAll) {
    //        if (addedAction && menu) {
    //          var sep = document.createElement("menuseparator");
    //          menu.appendChild(sep);
    //        }
    //        tempMenu = document.createElement("menuitem");
    //        tempMenu.label = Operator.actions[action].descriptionAll;
    //        tempMenu.setAttribute("label", tempMenu.label);
    //        tempMenu.store_oncommand = Operator.actionAllCallbackGenerator(semanticArrays, action);
    //        tempMenu.addEventListener("command", tempMenu.store_oncommand, false);
    //        tempMenu.store_onclick = Operator.clickAllCallbackGenerator(semanticArrays, action);
    //        tempMenu.addEventListener("click", tempMenu.store_onclick, false);
    //        if (menu) {
    //          menu.appendChild(tempMenu);
    //        } else {
    //          if (!popup) {
    //            popup = document.createElement("menupopup");
    //          }
    //          popup.appendChild(tempMenu);
    //          Operator_Toolbar.addButtonMenu(popup, null, action);
    //        }
    //      }
    //    }
    //    if (menu) {
    //      if (!popup) {
    //        popup = document.createElement("menupopup");
    //      }               
    //      tempMenu = document.createElement("menu");
    //      if (Operator.useShortDescriptions && Operator.actions[action].shortDescription) {
    //        tempMenu.label = Operator.actions[action].shortDescription;
    //      } else {
    //        tempMenu.label = Operator.actions[action].description;
    //      }
    //      tempMenu.setAttribute("label", tempMenu.label);
    //      popup.appendChild(tempMenu);
    //      if (menu.error === true) {
    //        tempMenu.style.fontWeight = "bold";
    //      }
    //      tempMenu.appendChild(menu);
    //
    //      Operator_Toolbar.addButtonMenu(menu, null, action);
    //      tempMenu = null;
    //    }
    //    menu = null;
    //    i++;
    //  } while (1);
    //}

    /* Semantic Data */
    if (Operator.view == 0) /* OR WE HAVE BUTTONS */ {
      i = 1;
      var semanticType;
      do {
        /* Get the active semantic items from preferences */
        try {
          semanticType = Operator.prefBranch.getCharPref("dataformat" + i);
        } catch (ex) {
          break;
        }
        /* If the semantic item is in our array and has items in this documents,
           process it */
        if (semanticType && semanticArrays[semanticType] && semanticArrays[semanticType].length > 0) {
          var objectArray;
          if (semanticType == "RDF") {
            objectArray = semanticArrays[semanticType][0].getObjects();
          } else {
            objectArray = semanticArrays[semanticType];
          }
          menu = Operator.buildMenu(objectArray, semanticType);
          if (menu) {
            if ((Operator.debug) && (semanticType == "RDF")) {
              var sep = document.createElement("menuseparator");
              menu.insertBefore(sep, menu.firstChild);
              tempMenu = document.createElement("menuitem");
              tempMenu.label = "View Model";
              tempMenu.setAttribute("label", tempMenu.label);
              tempMenu.store_oncommand = Operator.errorCallbackGenerator(semanticArrays[semanticType][0], semanticType);
              tempMenu.addEventListener("command", tempMenu.store_oncommand, false);
              menu.insertBefore(tempMenu, menu.firstChild);
            }
            var addsep = false;
            for (k in Operator.actions) {
              if (!Operator.actions[k].doActionAll) {
                continue;
              }
              if (!Operator.actions[k].scope) {
                continue;
              }
              if (!Operator.actions[k].scope.semantic[semanticType]) {
                continue;
              }
              if (Operator.actions[k].scope.url) {
                if (!(content.document.location.href.match(Operator.actions[k].scope.url))) {
                  continue;
                }
              }
              
              var required = null;
              if ((Operator.actions[k].scope.semantic[semanticType] != semanticType)  && (semanticType != "RDF")) {
                for (j=0; j < objectArray.length; j++) {
                  var reqprop = Operator.actions[k].scope.semantic[semanticType];
                  if (reqprop.indexOf(".") != -1) {
                    var props = reqprop.split(".");
                    if (objectArray[j][props[0]]) {
                      required = objectArray[j][props[0]][props[1]];
                    }
                  } else {
                    required = objectArray[j][reqprop];
                  }
                  if (required) {
                    break;
                  }
                }
              }
              if ((required) || (Operator.actions[k].scope.semantic[semanticType] == semanticType)) {
                if (!addsep) {
                  var sep = document.createElement("menuseparator");
                  menu.appendChild(sep);
                  addsep = true;
                }
                tempMenu = document.createElement("menuitem");
                tempMenu.label = Operator.actions[k].descriptionAll;
                tempMenu.setAttribute("label", tempMenu.label);
                tempMenu.store_oncommand = Operator.actionAllCallbackGenerator(semanticArrays, k, semanticType);
                tempMenu.addEventListener("command", tempMenu.store_oncommand, false);
                tempMenu.store_onclick = Operator.clickAllCallbackGenerator(semanticArrays, k, semanticType);
                tempMenu.addEventListener("click", tempMenu.store_onclick, false);
                menu.appendChild(tempMenu);
              }
            }

            if (!popup) {
             popup = document.createElement("menupopup");
            }
            tempMenu = document.createElement("menu");

            if (Operator.useDescriptiveNames) {
              if (Microformats[semanticType] && Microformats[semanticType].description) {
                tempMenu.label = Microformats[semanticType].description;
              } else if (semanticType == "RDF") {
                tempMenu.label = Operator.languageBundle.GetStringFromName("rdf.description");
              }
            }
            if (!tempMenu.label) {
              tempMenu.label = semanticType;
            }
            tempMenu.setAttribute("label", tempMenu.label);

            popup.appendChild(tempMenu);

            if (menu.error === true) {
              tempMenu.style.fontWeight = "bold";
            }

            tempMenu.appendChild(menu);

            Operator_Toolbar.addButtonMenu(menu, semanticType);
          }
        }
        i++;
      } while (1);
    }

    if (popup) {
      /* If we have a popup, add the Options menu to the end */
      var clonePopup = false;
      tempMenu = document.createElement("menuseparator");
      popup.appendChild(tempMenu);
      tempMenu = document.createElement("menuitem");
      tempMenu.setAttribute("label", Operator.languageBundle.GetStringFromName("operatorOptions.label"));
      tempMenu.label = action;
      tempMenu.store_oncommand = function() {window.openDialog('chrome://operator/content/operator_options.xul','options','chrome,centerscreen,modal');};
      tempMenu.addEventListener("command", tempMenu.store_oncommand, false);
      popup.appendChild(tempMenu);

      /* Add the menu to the various buttons */
      /* If clonePopup is set, then the menu is cloned before it is added */
      /* This is necessary since one menu can't be used for multiple things */
      if (Operator_ToolbarButton.isVisible()) {
        Operator_ToolbarButton.enable();
        clonePopup = clonePopup | Operator_ToolbarButton.addPopup(popup);
      }
      if (Operator.urlbar) {
        clonePopup = clonePopup | Operator_URLbarButton.addPopup(popup, clonePopup);
      }
      if (Operator_Statusbar.isVisible()) {
        Operator_Statusbar.enable();
        clonePopup = clonePopup | Operator_Statusbar.addPopup(popup, clonePopup);
      }
      if (Operator.autohide) {
        Operator_Toolbar.show();
      }
      Operator_Toolbar.enable();
    }
    Operator_Sidebar.populate(semanticArrays);
  },
  simpleEscape: function simpleEscape(s)
  {
    s = s.replace(/\&/g, '%26');
    s = s.replace(/\#/g, '%23');
    s = s.replace(/\+/g, '%2B');
    s = s.replace(/\=/g, '%3D');
    s = s.replace(/ /g, '+');
    return s;
  }
};

Operator.init();
