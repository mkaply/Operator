/*extern ufJSParser, Components, content */

var ufJSParser = {
  version: "0.2",
  microformats: [],
  init: function(ojl, baseurl) {
    if (Components && !ojl) {
      ojl = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].
                       getService(Components.interfaces.mozIJSSubScriptLoader);
    }
    if (ojl) {
      ojl.loadSubScript(baseurl + "microformats/adr.js");
      ojl.loadSubScript(baseurl + "microformats/hCard.js");
      ojl.loadSubScript(baseurl + "microformats/hCalendar.js");
      ojl.loadSubScript(baseurl + "microformats/hResume.js");
      ojl.loadSubScript(baseurl + "microformats/hReview.js");
      ojl.loadSubScript(baseurl + "microformats/geo.js");
      ojl.loadSubScript(baseurl + "microformats/xFolk.js");
      ojl.loadSubScript(baseurl + "microformats/tag.js");
      ojl.loadSubScript(baseurl + "microformats/hAtom.js");
      ojl.loadSubScript(baseurl + "microformats/bookmark.js");
    }
  },
  createMicroformat: function(in_mfnode, mfname)  {
    var mfnode = in_mfnode;
    var microformat = new ufJSParser.microformats[mfname].mfObject();
    var definition = ufJSParser.microformats[mfname].definition;
    var i;
    if (ufJSParser.microformats[mfname].className) {
      mfnode = ufJSParser.preProcessMicroformat(in_mfnode);
    }
    var foundProps = false;
    var foundValues = false;
    for (i in definition.properties) {
      var prop = ufJSParser.getMicroformatProperty(mfnode, mfname, i);
      if (prop) {
        foundProps = true;
        microformat[i] = prop;
      }
    }
    /* If it's an attribute microformat, get values */
    if (ufJSParser.microformats[mfname].attributeName) {
      for (i in definition.values) {
        var value = ufJSParser.getMicroformatProperty(mfnode, mfname, i);
        if (value) {
          foundValues = true;
          microformat[i] = value;
        }
      }
    }
    if (!foundProps && !foundValues) {
      if (definition.getter) {
        var result = definition.getter(mfnode, mfnode, definition);
        if (result) {
          return result;
        }
      }
      return;
    }

    return microformat;
  },
  getMicroformatProperty: function(in_mfnode, mfname, propname) {
    var definition = ufJSParser.microformats[mfname].definition;
    var i, j, k;
    var result;
    var mfnode = in_mfnode;
    if (ufJSParser.microformats[mfname].className) {
      mfnode = ufJSParser.preProcessMicroformat(in_mfnode);
    }
    var foundProps = false;
    var tp;
    if (definition.properties && definition.properties[propname]) {
      tp = definition.properties[propname];
    } else if (definition.values && definition.values[propname]) {
      tp = definition.values[propname];
    } else if (definition.ufjs && definition.ufjs[propname]) {
      tp = definition.ufjs[propname];
    }
/* OK this is strange so let me explain it. If we didn't find the property
   that was passed in, look for it among the subproperties. If you find it, 
   AND the classname of the passed in mfnode matches the parent property,
   use it. This allows us to pass in an hentry and get it's entry-title
   for instance */
    if (!tp) {
      for (i in definition.properties) {
        if (definition.properties[i].subproperties) {
          if (definition.properties[i].subproperties[propname]) {
            if (mfnode.className &&  mfnode.className.match("(^|\\s)" + i + "(\\s|$)")) {
              tp = definition.properties[i].subproperties[propname];
              break;
            }
          } else if ((definition.properties[i].ufjs) && (definition.properties[i].ufjs[propname])) {
            if (mfnode.className &&  mfnode.className.match("(^|\\s)" + i + "(\\s|$)")) {
              tp = definition.properties[i].ufjs[propname];
              break;
            }
          }
        }
      }
    }
    var propnodes;
    if (!tp) {
      /* propname contains a . - dereference it */
      if (propname.indexOf(".") != -1) {
        var props = propname.split(".");
        tp = definition.properties[props[0]];
        if (tp && tp.rel == true) {
          propnodes = ufJSParser.getElementsByAttribute(mfnode, "rel", props[0]);
        } else {
          propnodes = ufJSParser.getElementsByClassName(mfnode, props[0]);
        }
      }
    } else {
      if (tp && tp.rel == true) {
        propnodes = ufJSParser.getElementsByAttribute(mfnode, "rel", propname);
      } else {
        propnodes = ufJSParser.getElementsByClassName(mfnode, propname);
      }
    }

    var property;
    if (!tp) {
//      alert("Bad property name - " + propname);
      return;
    }
//    if (tp.value instanceof Array) {
//      property = [];
//    } else {
//      property = {};
//    }
    var curprop = 0;
    var validType, type;
    for (j = 0; j < propnodes.length; j++) {
      foundProps = true;
      var callPropertyGetter = true;
      if (tp.subproperties) {
        var subprop;
        for (subprop in tp.subproperties) {
          var foundSubProperties = false;
          var subpropnodes = ufJSParser.getElementsByClassName(propnodes[j], subprop);
          var cursubprop = 0;
          for (k = 0; k < subpropnodes.length; k++) {
            if (tp.subproperties[subprop].getter) {
              result = tp.subproperties[subprop].getter(subpropnodes[k], propnodes[j], definition);
            } else {
              result = definition.defaultGetter(subpropnodes[k]);
              if (tp.subproperties[subprop].types) {
                validType = false;
                for (type in tp.subproperties[subprop].types) {
                  if (result.toLowerCase() == tp.subproperties[subprop].types[type]) {
                    validType = true;
                    break;
                  }
                }
                if (!validType) {
                  continue;
                }
              }
            }
            if (result) {
              foundSubProperties = true;
              callPropertyGetter = false;
              if (tp.value instanceof Array) {
                if (!property) {
                  property = [];
                }
                if (!property[curprop]) {
                  property[curprop] = [];
                }
                if (tp.subproperties[subprop].value instanceof Array) {
                  if (!property[curprop][subprop]) {
                    property[curprop][subprop] = [];
                  }
                  property[curprop][subprop][cursubprop] = result;
                } else {
                  property[curprop][subprop] = result;
                }
              } else {
                if (!property) {
                  property = {};
                }
                if (tp.subproperties[subprop].value instanceof Array) {
                  if (!property[subprop]) {
                    property[subprop] = [];
                  }
                  property[subprop][cursubprop] = result;
                } else {
                  property[subprop] = result;
                }
              }
            }
            
            if (!(tp.subproperties[subprop].value instanceof Array)) {
              break;
            }
            cursubprop++;
          }
          if (!foundSubProperties) {
            if (tp.subproperties[subprop].virtual) {
              if (tp.subproperties[subprop].getter) {
                result = tp.subproperties[subprop].getter(propnodes[j], propnodes[j], definition);
                if (result) {
                  callPropertyGetter = false;
                  if (tp.value instanceof Array) {
                    if (!property) {
                      property = [];
                    }
                    if (!property[curprop]) {
                      property[curprop] = [];
                    }
                    if (tp.subproperties[subprop].value instanceof Array) {
                      if (!property[curprop][subprop]) {
                        property[curprop][subprop] = [];
                      }
                      property[curprop][subprop][cursubprop] = result;
                    } else {
                      property[curprop][subprop] = result;
                    }
                  } else {
                    if (!property) {
                      property = {};
                    }
                    if (tp.subproperties[subprop].value instanceof Array) {
                      if (!property[subprop]) {
                        property[subprop] = [];
                      }
                      property[subprop][cursubprop] = result;
                    } else {
                      property[subprop] = result;
                    }
                  }
                }
              }
            }
          }
        }
      }
      /* If we didn't find any sub properties for the property, check
         to see if the property has a getter. If it does, call it. This
         is to handle cases where the property sets up the subproperty
         (org->organization-name) */
      if (callPropertyGetter) {
        if (tp.getter) {
          result = tp.getter(propnodes[j], mfnode, definition);
        } else {
          result = definition.defaultGetter(propnodes[j]);
          if (tp.types) {
            validType = false;
            for (type in tp.types) {
              if (result.toLowerCase() == tp.types[type]) {
                validType = true;
                break;
              }
            }
            if (!validType) {
              continue;
            }
          }
        }
        if (result) {
          if (tp.value instanceof Array) {
            if (!property) {
              property = [];
            }
            property[curprop] = result;
          } else {
            if (!property) {
              property = {};
            }
            property = result;
          }
        }
        if (!(tp.value instanceof Array)) {
          break;
        }
      }
      curprop++;
    }
    /* If we didn't find the property, check to see if it is a virtual
       property and if so, call it's getter. */
    if (!foundProps) {
      if (tp.virtual) {
        if (tp.getter) {
          result = tp.getter(mfnode, mfnode, definition);
          if (tp.value instanceof Array) {
            if (result) {
              if (!property) {
                property = [];
              }
              property[0] = result;
            } else {
              return;
            }
          } else {
            if (result) {
              property = result;
            } else {
              return;
            }
          }
        }
      } else {
        return;
      }
    }
    /* propname contains a . - dereference it */
    if (propname.indexOf(".") != -1) {
      var props = propname.split(".");
      return property[props[1]];
    }
    return property;
  },
  /* This function takes care of includes and headers */
  preProcessMicroformat: function(in_mfnode) {
    var mfnode;
    var i;
    var includes = ufJSParser.getElementsByClassName(in_mfnode, "include");
    if ((includes.length > 0) || ((in_mfnode.nodeName.toLowerCase() == "td") && (in_mfnode.getAttribute("headers")))) {
      mfnode = in_mfnode.cloneNode(true);
      mfnode.origNode = in_mfnode;
      if (includes.length > 0) {
        includes = ufJSParser.getElementsByClassName(mfnode, "include");
        var includeId;
        var include_length = includes.length;
        for (i = include_length -1; i >= 0; i--) {
          if (includes[i].nodeName.toLowerCase() == "a") {
            includeId = includes[i].getAttribute("href").substr(1);
          }
          if (includes[i].nodeName.toLowerCase() == "object") {
            includeId = includes[i].getAttribute("data").substr(1);
          }
          try {
            includes[i].parentNode.replaceChild(in_mfnode.ownerDocument.getElementById(includeId).cloneNode(true), includes[i]);
          } catch(ex) {}
        }
      } else {
        var headers = in_mfnode.getAttribute("headers").split(" ");
        for (i = 0; i < headers.length; i++) {
          try {
            mfnode.appendChild(in_mfnode.ownerDocument.getElementById(headers[i]).cloneNode(true));
          } catch(ex) {}
        }
      }
    } else {
      mfnode = in_mfnode;
    }
    return mfnode;
  },
  getElementsByClassName: function(rootElement, className)
  {
    var returnElements = [];

    if (document.evaluate) {
      var xpathExpression = ".//*[contains(concat(' ', @class, ' '), ' " + className + " ')]";
      var xpathResult = (rootElement.ownerDocument || rootElement).evaluate(xpathExpression, rootElement, null, 0, null);

      var node = xpathResult.iterateNext();
  
      while (node) {
        returnElements.push(node);
        node = xpathResult.iterateNext();
      }
    } else {
      className = className.replace(/\-/g, "\\-");
      var elements = rootElement.getElementsByTagName("*");
      for (var i=0;i<elements.length;i++) {
        if (elements[i].className.match("(^|\\s)" + className + "(\\s|$)")) {
          returnElements.push(elements[i]);
        }
      }
    }
    return returnElements;
  },
  /* Needs to be ported to work in Internet Explorer/Opera */
  getElementsByAttribute: function(rootElement, attributeName, in_attributeList)
  {
    var attributeList;
    if (in_attributeList instanceof Array) {
      attributeList = in_attributeList;
    } else {
      attributeList = in_attributeList.split(" ");
    }

    var returnElements = [];

    var xpathExpression = ".//*[";
    var i;
    for (i in attributeList) {
      if (i != 0) {
        xpathExpression += " or ";
      }
      xpathExpression += "contains(concat(' ', @" + attributeName + ", ' '), ' " + attributeList[i] + " ')";
    }
    xpathExpression += "]"; 

    var xpathResult = (rootElement.ownerDocument || rootElement).evaluate(xpathExpression, rootElement, null, 0, null);

    var node = xpathResult.iterateNext();

    while (node) {
      returnElements.push(node);
      node = xpathResult.iterateNext();
    }
    return returnElements;
  },
  /* I know this doesn't belong here, but I need a central location to edit it */
  trim: function(s)
  {
    /* Remove any HTML tags and their contents */
    /* This used to be replacing with a space - I don't like that */
    s	= s.replace(/\<.*?\>/gi, '');
    /* Remove new lines, carriage returns and tabs */
    s	= s.replace(/[\n\r\t]/gi, ' ');
    /* Replace any double spaces with single spaces */
    s	= s.replace(/\s{2,}/gi, ' ');
    /* Remove any double spaces that are left */
    s	= s.replace(/\s{2,}/gi, '');
    /* Remove any spaces at the beginning */
    s	= s.replace(/^\s+/, '');
    /* Remove any spaces at the end */
    s	= s.replace(/\s+$/, '');
    return s;
  },
  validate: function(mfnode, mfname, error) {
    if (ufJSParser.microformats[mfname].validate) {
      return ufJSParser.microformats[mfname].validate(mfnode, error);
    } else {
      return true;
    }
  }
};

