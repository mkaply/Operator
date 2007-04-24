/*extern ufJSParser, Components, content */

var ufJSParser = {
  version: "0.2",
  microformats: {},
  init: function(ojl, baseurl) {
    if (Components && !ojl) {
      ojl = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].
                       getService(Components.interfaces.mozIJSSubScriptLoader);
    }
    if (ojl) {
      ojl.loadSubScript(baseurl + "microformats/adr.js");
      ojl.loadSubScript(baseurl + "microformats/hCard.js");
      ojl.loadSubScript(baseurl + "microformats/hCalendar.js");
      ojl.loadSubScript(baseurl + "microformats/tag.js");
      ojl.loadSubScript(baseurl + "microformats/geo.js");
      ojl.loadSubScript(baseurl + "microformats/xFolk.js");
    }
  },
  newMicroformat: function(object, in_node, microformat) {
    /* check to see if we are even valid */
    if (!ufJSParser.microformats[microformat]) {
      throw("Invalid microformat");
    }
    if (ufJSParser.microformats[microformat].attributeName) {
      if (!(in_node.getAttribute(ufJSParser.microformats[microformat].attributeName))) {
        throw("Node is not a microformat (" + microformat + ")");
      }
    } else {
      if (!(in_node.className.match("(^|\\s)" + ufJSParser.microformats[microformat].className + "(\\s|$)"))) {
        throw("Node is not a microformat (" + microformat + ")");
      }
    }
    var node = in_node;
    var definition = ufJSParser.microformats[microformat].definition;
    if (ufJSParser.microformats[microformat].className) {
      node = ufJSParser.preProcessMicroformat(in_node);
    }

    for (var i in definition.properties) {
      object.__defineGetter__(i, ufJSParser.getMicroformatPropertyGenerator(node, microformat, i, object));
    }
    
    object.node = node;
  },
  getMicroformatPropertyGenerator: function(node, name, property, microformat)
  {
    return function() {
      var result = ufJSParser.getMicroformatProperty(node, name, property);
      delete microformat[property];
      if (result) {
        microformat[property] = result; 
        return result;
      }
    };
  },
  createMicroformat: function(in_mfnode, mfname)  {
    if (document.__defineGetter__) {
      try {
        return new ufJSParser.microformats[mfname].mfObject(in_mfnode);
      } catch (ex) {
        return;
      }
    }
    /* check to see if we are even valid */
    if (!ufJSParser.microformats[mfname]) {
      return;
    }
    if (ufJSParser.microformats[mfname].attributeName) {
      if (!(in_mfnode.getAttribute(ufJSParser.microformats[mfname].attributeName))) {
        return;
      }
    } else {
      if (!(in_mfnode.className.match("(^|\\s)" + ufJSParser.microformats[mfname].className + "(\\s|$)"))) {
        return;
      }
    }
    var mfnode = in_mfnode;
    var microformat = new ufJSParser.microformats[mfname].mfObject();
    var definition = ufJSParser.microformats[mfname].definition;
    var i;
    if (ufJSParser.microformats[mfname].className) {
      mfnode = ufJSParser.preProcessMicroformat(in_mfnode);
    }
    var foundProps = false;
    for (i in definition.properties) {
      var prop = ufJSParser.getMicroformatProperty(mfnode, mfname, i);
      if (prop) {
        foundProps = true;
        microformat[i] = prop;
      }
    }
    if (!foundProps) {
      return;
    }

    return microformat;
  },
  getMicroformatProperty: function(in_mfnode, mfname, propname) {
    var definition = ufJSParser.microformats[mfname].definition;
    var i, j, k;
    var result;
    var mfnode = in_mfnode;
    if (!in_mfnode.origNode && ufJSParser.microformats[mfname].className) {
      mfnode = ufJSParser.preProcessMicroformat(in_mfnode);
    }
    var foundProps = false;
    var tp;
    if (definition.properties && definition.properties[propname]) {
      tp = definition.properties[propname];
    } else if (definition.ufjs && definition.ufjs[propname]) {
      tp = definition.ufjs[propname];
    }
/* OK this is strange so let me explain it. If we didn't find the property
   that was passed in, look for it among the subproperties. If you find it, 
   AND the classname of the passed in mfnode matches the parent property,
   use it. This allows us to pass in an hentry and get it's entry-title
   for instance. This only works one level deep. */
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
            if (tp.subproperties[subprop].datatype) {
              result = ufJSParser.datatypeHelper(tp.subproperties[subprop], subpropnodes[k], propnodes[j]);
            } else {
              result = ufJSParser.defaultGetter(subpropnodes[k], propnodes[j]);
              if ((tp.subproperties[subprop].implied) && (result)) {
                var temp = result;
                result = {};
                result[tp.subproperties[subprop].implied] = temp;
              }
            }
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
            if (result) {
              foundSubProperties = true;
              callPropertyGetter = false;
              if (tp.plural) {
                if (!property) {
                  property = [];
                }
                if (!property[curprop]) {
                  property[curprop] = [];
                }
                if (tp.subproperties[subprop].plural) {
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
                if (tp.subproperties[subprop].plural) {
                  if (!property[subprop]) {
                    property[subprop] = [];
                  }
                  property[subprop][cursubprop] = result;
                } else {
                  property[subprop] = result;
                }
              }
            }
            
            if (!tp.subproperties[subprop].plural) {
              break;
            }
            cursubprop++;
          }
          if (!foundSubProperties) {
            if (tp.subproperties[subprop].virtual) {
              if (tp.subproperties[subprop].virtualGetter) {
                result = tp.subproperties[subprop].virtualGetter(propnodes[j], propnodes[j]);
              } else {
                result = ufJSParser.datatypeHelper(tp.subproperties[subprop], propnodes[j]);
              }
              if (result) {
                callPropertyGetter = false;
                if (tp.plural) {
                  if (!property) {
                    property = [];
                  }
                  if (!property[curprop]) {
                    property[curprop] = [];
                  }
                  if (tp.subproperties[subprop].plural) {
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
                  if (tp.subproperties[subprop].plural) {
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
      /* If we didn't find any sub properties for the property, check
         to see if the property has a getter. If it does, call it. This
         is to handle cases where the property sets up the subproperty
         (org->organization-name) */
      if (callPropertyGetter) {
        if (tp.datatype) {
          result = ufJSParser.datatypeHelper(tp, propnodes[j]);
        } else {
          result = ufJSParser.defaultGetter(propnodes[j]);
          if ((tp.implied) && (result)) {
            var temp = result;
            result = {};
            result[tp.implied] = temp;
          }
        }
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
        if (result) {
          if (tp.plural) {
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
        if (!tp.plural) {
          break;
        }
      }
      curprop++;
    }
    /* If we didn't find the property, check to see if it is a virtual
       property and if so, call it's getter. */
    if (!foundProps) {
      if (tp.virtual) {
        if (tp.virtualGetter) {
          result = tp.virtualGetter(mfnode, mfnode);
        } else {
          result = ufJSParser.datatypeHelper(tp, mfnode);
        }
        if (tp.cardinality == "plural") {
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
      } else {
        return;
      }
    }
    /* propname contains a . - dereference it */
    /* this needs to be way more robust */
    /* check if property is an array and if so only return 1st element */
    /* handle multuiple nestings */
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
  getElementsByClassName: function(rootNode, className)
  {
    var returnElements = [];

    if (document.getElementsByClassName) {
      var col = rootNode.getElementsByClassName(className);
      for (i = 0; i < col.length; i++) {
        returnElements[i] = col[i];
      }
    } else if (document.evaluate) {
      var xpathExpression = ".//*[contains(concat(' ', @class, ' '), ' " + className + " ')]";
      var xpathResult = (rootNode.ownerDocument || rootNode).evaluate(xpathExpression, rootNode, null, 0, null);

      var node = xpathResult.iterateNext();
  
      while (node) {
        returnElements.push(node);
        node = xpathResult.iterateNext();
      }
    } else {
      className = className.replace(/\-/g, "\\-");
      var elements = rootNode.getElementsByTagName("*");
      for (var i=0;i<elements.length;i++) {
        if (elements[i].className.match("(^|\\s)" + className + "(\\s|$)")) {
          returnElements.push(elements[i]);
        }
      }
    }
    return returnElements;
  },
  /* Needs to be ported to work in Internet Explorer/Opera */
  getElementsByAttribute: function(rootNode, attributeName, in_attributeList)
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

    var xpathResult = (rootNode.ownerDocument || rootNode).evaluate(xpathExpression, rootNode, null, 0, null);

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
    if (s.length > 0) {
      return s;
    }
  },
  validate: function(mfnode, mfname, error) {
    if (ufJSParser.microformats[mfname].validate) {
      return ufJSParser.microformats[mfname].validate(mfnode, error);
    } else {
      if (ufJSParser.microformats[mfname].required) {
        var mfobject = new ufJSParser.microformats[mfname].mfObject(mfnode);
        error.message = "";
        for (var i=0;i<ufJSParser.microformats[mfname].required.length;i++) {
          if (!mfobject[ufJSParser.microformats[mfname].required[i]]) {
            error.message += "Required property " + ufJSParser.microformats[mfname].required[i] + " not specified\n";
          }
        }
        if (error.message.length > 0) {
          return false;
        }
      }
      return true;
    }
  },
  defaultGetter: function(propnode, parentnode) {
    if (((propnode.nodeName.toLowerCase() == "abbr") || (propnode.nodeName.toLowerCase() == "html:abbr")) && (propnode.getAttribute("title"))) {
      return propnode.getAttribute("title");
    } else if ((propnode.nodeName.toLowerCase() == "img") && (propnode.getAttribute("alt"))) {
      return propnode.getAttribute("alt");
    } else if ((propnode.nodeName.toLowerCase() == "area") && (propnode.getAttribute("alt"))) {
      return propnode.getAttribute("alt");
    } else {
      var values;
      /* This is ugly. Some cases (email and tel for hCard) are called value */
      /* but can also use value-excerpting. This handles that */
      if (parentnode && propnode.className.match("(^|\\s)" + "value" + "(\\s|$)")) {
        var parent_values = ufJSParser.getElementsByClassName(parentnode, "value");
        if (parent_values.length > 1) {
          values = parent_values;
        }
      }
      if (!values) {
        values = ufJSParser.getElementsByClassName(propnode, "value");
      }
      if (values.length > 0) {
        var value = "";
        for (var j=0;j<values.length;j++) {
          if (values[j].innerText) {
            value += values[j].innerText;
          } else {
            value += values[j].textContent;
          }
        }
        return value;
      } else {
        var s;
        if (propnode.innerText) {
          s = propnode.innerText;
        } else {
          s = propnode.textContent;
        }
        return ufJSParser.trim(s);
      }
    }
  },
  dateTimeGetter: function(propnode, parentnode) {
    var date = ufJSParser.defaultGetter(propnode, parentnode);
    if (date) {
      return ufJSParser.normalizeISO8601(date);
    }
  },
  uriGetter: function(propnode, parentnode) {
    if (propnode.nodeName.toLowerCase() == "a") {
      return propnode.href;
    } else if (propnode.nodeName.toLowerCase() == "img") {
      return propnode.src;
    } else if (propnode.nodeName.toLowerCase() == "object") {
      return propnode.data;
    } else if (propnode.nodeName.toLowerCase() == "area") {
      return propnode.href;
    } else {
      return ufJSParser.defaultGetter(propnode, parentnode);
    }
  },
  emailGetter: function(propnode, parentnode) {
    if ((propnode.nodeName.toLowerCase() == "a") || (propnode.nodeName.toLowerCase() == "area")) {
      var mailto = propnode.href;
      if (mailto.indexOf('?') > 0) {
        return mailto.substring("mailto:".length, mailto.indexOf('?'));
      } else {
        return mailto.substring("mailto:".length);
      }
    } else {
      return ufJSParser.defaultGetter(propnode, parentnode);
    }
  },
  HTMLGetter: function(propnode, parentnode) {
    return propnode.innerHTML;
  },
  datatypeHelper: function(prop, node, parentnode) {
    var result;
    switch (prop.datatype) {
      case "dateTime":
        result = ufJSParser.dateTimeGetter(node, parentnode);
        break;
      case "anyURI":
        result = ufJSParser.uriGetter(node, parentnode);
        break;
      case "email":
        result = ufJSParser.emailGetter(node, parentnode);
        break;
      case "HTML":
        result = ufJSParser.HTMLGetter(node, parentnode);
        break;
      case "float":
        result = parseFloat(ufJSParser.defaultGetter(node, parentnode));
        break;
      case "custom":
        result = prop.customGetter(node, parentnode);
        break;
      case "microformat":
        try {
          result = ufJSParser.createMicroformat(node, prop.microformat);
        } catch (ex) {}
        if (result) {
          if (prop.microformat_property) {
            result = result[prop.microformat_property];
          }
          break;
        }
      default:
        result = ufJSParser.defaultGetter(node, parentnode);
        if ((prop.implied) && (result)) {
          var temp = result;
          result = {};
          result[prop.implied] = temp;
        }
        break;
    }
    return result;
  },
  /* This function normalizes an ISO8601 date by adding punctuation and */
  /* ensuring that hours and seconds have values */
  normalizeISO8601: function(string)
  {
    var dateArray = string.match(/(\d\d\d\d)(?:-?(\d\d)(?:-?(\d\d)(?:[T ](\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(?:([-+Z])(?:(\d\d)(?::?(\d\d))?)?)?)?)?)?/);

    var dateString;
    if (dateArray[1]) {
      dateString = dateArray[1];
      if (dateArray[2]) {
        dateString += "-" + dateArray[2];
        if (dateArray[3]) {
          dateString += "-" + dateArray[3];
          if (dateArray[4]) {
            dateString += "T" + dateArray[4];
            if (dateArray[5]) {
              dateString += ":" + dateArray[5];
            } else {
              dateString += ":" + "00";
            }
            if (dateArray[6]) {
              dateString += ":" + dateArray[6];
            } else {
              dateString += ":" + "00";
            }
            if (dateArray[7]) {
              dateString += "." + dateArray[7];
            }
            if (dateArray[8]) {
              dateString += dateArray[8];
              if ((dateArray[8] == "+") || (dateArray[8] == "-")) {
                if (dateArray[9]) {
                  dateString += dateArray[9];
                  if (dateArray[10]) {
                    dateString += ":" + dateArray[10];
                  }
                }
              }
            }
          }
        }
      }
    }
    return dateString;
  },
  localizeISO8601: function(string)
  {
    var dateArray = string.match(/(\d\d\d\d)(?:-?(\d\d)(?:-?(\d\d)(?:[T ](\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(?:([-+Z])(?:(\d\d)(?::?(\d\d))?)?)?)?)?)?/);
  
    var date = new Date(dateArray[1], 0, 1);
    date.time = false;

    if (dateArray[2]) {
      date.setMonth(dateArray[2] - 1);
    }
    if (dateArray[3]) {
      date.setDate(dateArray[3]);
    }
    if (dateArray[4]) {
      date.setHours(dateArray[4]);
      date.time = true;
      if (dateArray[5]) {
        date.setMinutes(dateArray[5]);
        if (dateArray[6]) {
          date.setSeconds(dateArray[6]);
          if (dateArray[7]) {
            date.setMilliseconds(Number("0." + dateArray[7]) * 1000);
          }
        }
      }
    }
    if (dateArray[8]) {
      if (dateArray[8] == "-") {
        if (dateArray[9] && dateArray[10]) {
          date.setHours(date.getHours() + parseInt(dateArray[9], 10));
          date.setMinutes(date.getMinutes() + parseInt(dateArray[10], 10));
        }
      } else if (dateArray[8] == "+") {
        if (dateArray[9] && dateArray[10]) {
          date.setHours(date.getHours() - parseInt(dateArray[9], 10));
          date.setMinutes(date.getMinutes() - parseInt(dateArray[10], 10));
        }
      }
      /* at this point we have the time in gmt */
      /* convert to local if we had a Z - or + */
      if (dateArray[8]) {
        var tzOffset = date.getTimezoneOffset();
        if (tzOffset < 0) {
          date.setMinutes(date.getMinutes() + tzOffset); 
        } else if (tzOffset > 0) {
          date.setMinutes(date.getMinutes() - tzOffset); 
        }
      }
    }
    return ufJSParser.iso8601FromDate(date, true);
  },
  /* This function does NOT honor Z and Timezone offsets because */
  /* JavaScript dates don't support them. It's only job is to represent */
  /* an ISO date as a date object exactly, dropping Z and TZ offsets */
  /* It is recommended that this only be called with a localized ISO date */
  dateFromISO8601: function(string)
  {
    var dateArray = string.match(/(\d\d\d\d)(?:-?(\d\d)(?:-?(\d\d)(?:[T ](\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(?:([-+Z])(?:(\d\d)(?::?(\d\d))?)?)?)?)?)?/);
  
    var date = new Date(dateArray[1], 0, 1);
    date.time = false;

    if (dateArray[2]) {
      date.setMonth(dateArray[2] - 1);
    }
    if (dateArray[3]) {
      date.setDate(dateArray[3]);
    }
    if (dateArray[4]) {
      date.setHours(dateArray[4]);
      date.time = true;
      if (dateArray[5]) {
        date.setMinutes(dateArray[5]);
        if (dateArray[6]) {
          date.setSeconds(dateArray[6]);
          if (dateArray[7]) {
            date.setMilliseconds(Number("0." + dateArray[7]) * 1000);
          }
        }
      }
    }
    return date;
  },
  iso8601FromDate: function(date, punctuation)
  {
    var string = date.getFullYear().toString();
    if (punctuation) {
      string += "-";
    }
    string += (date.getMonth() + 1).toString().replace(/\b(\d)\b/g, '0$1');
    if (punctuation) {
      string += "-";
    }
    string += date.getDate().toString().replace(/\b(\d)\b/g, '0$1');
    if (date.time) {
      string += "T";
      string += date.getHours().toString().replace(/\b(\d)\b/g, '0$1');
      if (punctuation) {
        string += ":";
      }
      string += date.getMinutes().toString().replace(/\b(\d)\b/g, '0$1');
      if (punctuation) {
        string += ":";
      }
      string += date.getSeconds().toString().replace(/\b(\d)\b/g, '0$1');
      if (date.getMilliseconds() > 0) {
        if (punctuation) {
          string += ".";
        }
        string += date.getMilliseconds().toString();
      }
    }
    return string;
  }
};

