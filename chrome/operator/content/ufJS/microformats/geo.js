/*extern ufJSParser */

function geo() {
}

ufJSParser.microformats.geo = {
  version: "0.2",
  mfName: "Geolocation",
  mfObject: geo,
  className: "geo",
  required: ["latitude","longitude"],
  definition: {
    properties: {
      "latitude" : {
        value: ""
      },
      "longitude" : {
        value: ""
      }
    },
    ufjs: {
      "ufjsDisplayName" : {
        value: "",
        virtual: true,
        getter: function(propnode, mfnode, definition) {
          if (ufJSParser.getMicroformatProperty(mfnode, "geo", "latitude") &&
            ufJSParser.getMicroformatProperty(mfnode, "geo", "longitude")) {
  
            var s;
            if (propnode.innerText) {
              s = mfnode.innerText;
            } else {
              s = mfnode.textContent;
            }

            s = ufJSParser.trim(s);

            /* FIXME - THIS IS FIREFOX SPECIFIC */
            /* check if geo is contained in a vcard */
            var xpathExpression = "ancestor::*[contains(concat(' ', @class, ' '), ' vcard ')]";
            var xpathResult = mfnode.ownerDocument.evaluate(xpathExpression, mfnode, null,  XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (xpathResult.singleNodeValue) {
              var hcard = ufJSParser.createMicroformat(xpathResult.singleNodeValue, "hCard");
              if (hcard.fn) {
                return hcard.fn;
              }
            }
            /* check if geo is contained in a vevent */
            xpathExpression = "ancestor::*[contains(concat(' ', @class, ' '), ' vevent ')]";
            xpathResult = mfnode.ownerDocument.evaluate(xpathExpression, mfnode, null,  XPathResult.FIRST_ORDERED_NODE_TYPE, xpathResult);
            if (xpathResult.singleNodeValue) {
              var hcal = ufJSParser.createMicroformat(xpathResult.singleNodeValue, "hCalendar");
              if (hcal.summary) {
                return hcal.summary;
              }
            }
            return s;
          }
        }
      }
    },
    getter: function(mfnode) {
      var value = this.defaultGetter(mfnode);
      var latlong;
      if (value.match(';')) {
        latlong = value.split(';');
        if (latlong[0] && latlong[1]) {
          return { "latitude" : latlong[0], "longitude" : latlong[1] };
        }
      }
      return;
    },
    defaultGetter: function(propnode) {
      if ((propnode.nodeName.toLowerCase() == "abbr") && (propnode.getAttribute("title"))) {
        return propnode.getAttribute("title");
      } else {
        var s;
        if (propnode.innerText) {
          s = propnode.innerText;
        } else {
          s = propnode.textContent;
        }
        s	= s.replace(/\<.*?\>/gi, ' ');
        s	= s.replace(/[\n\r\t]/gi, ' ');
        s	= s.replace(/\s{2,}/gi, ' ');
        s	= s.replace(/\s{2,}/gi, '');
        s	= s.replace(/^\s+/, '');
        return s;
      }
    }
  },
  validate: function(node, error) {
    error.message = "";
    if (!ufJSParser.getMicroformatProperty(node, "geo", "latitude")) {
      error.message += "No latitude specified\n";
    }
    if (!ufJSParser.getMicroformatProperty(node, "geo", "longitude")) {
      error.message += "No longitude specified\n";
    }
    if (error.message.length > 0) {
      return false;
    }
    return true;
  }
};
