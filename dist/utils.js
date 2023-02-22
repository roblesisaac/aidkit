const convert = {
  toArray: (data) => {
    return Array.isArray(data)
      ? data
      : Object.prototype.toString.call(data) == "[object Arguments]" // if its an arguments object
      ? Array.from(data)
      : [data];
  },
  toInstruct: (steps, args) => {
    let instruct = steps;

    if(typeof steps == "function") {
      try {
        instruct = steps.apply(this, args || []);
        if(typeof instruct == "string") instruct = [instruct];
      } catch (error) {
        instruct = [steps];
      }
      
    }
    
    const arr = Array.isArray(instruct) ? instruct : [steps];

    return arr.flat();
  },
  toObject: (data, caller) => {
    caller = caller || this;
    if (typeof data == "function") data = data.call(caller);
    return typeof data == "object" && !Array.isArray(data) ? data : {
      data
    };
  },
  toString: (obj) => {
    return "{" + Object.keys(obj).map(function(k) {
      return '"' + k + '":' + obj[k].toString();
    }).join(",") + "}";
  }
};
  
const addMethodTo = (type, name, value) => {
  const proto = type.prototype;
  if (!proto || proto[name]) return;
  Object.defineProperty(proto, name, {
    value,
    enumerable: false,
    writable: true
  });
};
  
addMethodTo(Array, "loop", function(method, i = 0) {
  const next = () => {
      this.loop(method, i + 1);
    },
    finish = (promise) => {
      promise = promise || this._promise;

      if (promise) promise.call(this);
    };

  if (i == this.length) {
    finish();
    return {
      then: finish
    };
  }

  method(i, this[i], function() {
    setTimeout(next);
  });

  return {
    then: (promise) => {
      this._promise = promise;
    }
  };
});
addMethodTo(Array, "excludes", function(keyword) {
  return this.indexOf(keyword) == -1;
});
addMethodTo(Array, "includes", function(keyword) {
  return this.indexOf(keyword) > -1;
});
  
const arrFinder =  function (item, filter) {
  return Object.keys(filter).every(key => filter[key] === item[key]);
}
  
addMethodTo(Array, "get", function(filter) {
  return this.filter(item => arrFinder(item, filter));
});
addMethodTo(Array, "getOne", function(filter) {
  return this.find(item => arrFinder(item, filter));
});

const getArgNames = function(fn) {
  if(typeof fn != "function") return [];

  const notArgs = /(\/\/.*$)|(\/\*[\s\S]*?\*\/)|(\s*=[^,\)]*(('(?:\\'|[^'\r\n])*')|("(?:\\"|[^"\r\n])*"))|(\s*=[^,\)]*))/mg,
      argNames = /([^\s,]+)/g,
      fnStr = fn.toString().replace(notArgs, ""),
      argStart = fnStr.indexOf("(")+1,
      argEnd = fnStr.indexOf(")");
  
  return fnStr.slice(argStart, argEnd).match(argNames) || [];
};

const getArgs = function(fn, args) {
  if(!args || typeof fn != "function") return {};

  const argNames = getArgNames(fn),
      result = {};
        
  argNames.forEach((argName, i) => {
    result[argName] = args[i];
  });
  
  return result;
};
  
const obj = {
  assignNative: function(obj, prop, value) {
    Object.defineProperty(obj, prop, {
      enumerable: false,
      writable: true,
      value
    });
  },
  copy: function(object) {
    if (null === object || typeof object != "object") return object;
    const copy = object.constructor();
    for (const attr in object) {
      if (object.hasOwnProperty(attr)) copy[attr] = object[attr];
    }
    return copy;
  },
  deep: function(object, props, sliced) {
    if (!object || !props) return;

    if (!sliced) {
      if (typeof props == "string") props = props.split(".");
      if (!props.slice) return props;
      sliced = props.slice();
    }

    const nested = object[sliced.shift()];

    return sliced.length ?
      this.deep(nested, props, sliced) :
      nested;
  },
  hasProp: function(object, prop) {
    return !object ?
      false :
      Object.keys(object).includes(prop) || !!object[prop];
  },
  isEmpty: function(object) {
    const props = Object.keys(object);
    return Array.isArray(props) && !props.length;
  },
  tip: function(obj, props, sliced) {
    if (!obj) return;

    if (!Array.isArray(props)) props = props.split(".");

    const arrProps = sliced ? props : props.slice(),
      nested = arrProps.length > 1 ? obj[arrProps.shift()] : obj;

    return arrProps.length > 1 ?
      this.tip(nested, arrProps, true) : {
        item: nested,
        prop: arrProps[0]
      };
  },
  watch: function(object, prop, fn) {
    let og = object[prop];
    Object.defineProperty(object, prop, {
      get: () => og,
      set: function(value) {
        if (fn) fn(value);
        og = value;
      }
    });
  }
};

const type = {
  isObject: obj => obj !== null && !Array.isArray(obj) && typeof obj == "object"
};
  
addMethodTo(String, "includes", function() {
  "use strict";
  return String.prototype.indexOf.apply(this, arguments) != -1;
});
addMethodTo(String, "excludes", function() {
  "use strict";
  return String.prototype.indexOf.apply(this, arguments) == -1;
});
addMethodTo(String, "matchCount", function() {
  const str = this.valueOf();
  let matches = 0;

  for (const i in arguments) {
    const value = arguments[i];
    if (str.includes(value)) matches++;
  }

  return matches;
});
addMethodTo(String, "excludesAll", function() {
  const matchCount = this.matchCount.apply(this, arguments);

  return !matchCount;
});
addMethodTo(String, "includesAll", function() {
  const args = arguments,
    matchCount = this.matchCount.apply(this, args);

  return matchCount == args.length;
});
addMethodTo(String, "includesAny", function() {
  const matchCount = this.matchCount.apply(this, arguments);

  return !!matchCount;
});
  
export { convert, getArgNames, getArgs, obj, type };