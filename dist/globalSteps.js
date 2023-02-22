import { convert, obj, type } from "./utils.js";

export default {
  "&": function(lastCondition) {
    if (!this._conditions) {
      this._addTools({
        _conditions: [lastCondition]
      });
    }
  },
  alert: function(messageProp) {
    const message = obj.deep(this, messageProp);
    alert(message || messageProp);
  },
  concat: function(dataProp) {
    const data = obj.deep(this, dataProp) || dataProp,
        to = obj.tip(this, this.to),
        { item, prop } = to;
        
    item[prop] = item[prop].concat(data); 
  },
  download: function (data, next) {
    data = obj.deep(this, data) || data;
    
    if(!data) {
      console.error("No Data");
      return;
    }
    
    const filename = this.filename || "download.json";
    
    if(typeof data == "object"){
      data = JSON.stringify(data, undefined, 4);
    }
    
    const blob = new Blob([data], {type: "text/json"}),
        e    = document.createEvent("MouseEvents"),
        a    = document.createElement("a");
        
    a.download = filename;
    a.href = window.URL.createObjectURL(blob);
    a.dataset.downloadurl =  ["text/json", a.download, a.href].join(":");
    e.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    a.dispatchEvent(e);
    
    next();
  },
  each: function(res, next) {
    const each = this._step.each,
        iteration = each.run || each.async,
        getData = each.each;

    const methodForEach = (i, item, nxt) => {
      this._import({ i, item });
      iteration.method(this, nxt);
    };

    const loopThruData = (data) => {
      if (!Array.isArray(data)) {
        console.error({ notAnArray: data });
        return;
      }

      if (each.async) {
        data.loop(methodForEach).then(next);
        return;
      }

      for (let i = 0; i < data.length; i++) {
        methodForEach(i, data[i]);
      }

      next();
    }

    getData.method(this, loopThruData);
  },
  end: function (message) {
    this._addTools({ _endAll: true });
    this.next(message);
  },
  error: function(error) {
    const message = obj.deep(this, error),
          _error = typeof message == "object"
                    ? JSON.stringify(message) : message,
          step = this._step;
        
    return step.handleError(this, { _error });
  },
  expose: function(prop, next) {
    const item = obj.deep(this, prop);
    next(item);
  },
  has: function(props) {
    const item = obj.deep(this, props);

    this.next(!!item || item === 0);
  },
  if: function(res, next) {
    const data = this._step.if,
        condition = data.if || data.switch;

    condition.method(this, (res) => {
      let answer = data[res];
      const allTrue = arr => !arr.filter(item => !item).length,
            conds = this._conditions;

      if (conds) {
        answer = data[allTrue(conds)];
      }

      delete this._conditions;

      if (!answer) {
        next();
        return;
      };

      answer.method(this, next);
    });
  },
  incr: function(counterProp, amount) {
    const counter = obj.tip(this, counterProp),
        { item, prop } = counter;
    
    if(amount && !isNaN(parseFloat(amount))) {
      item[prop] = item[prop] + amount;
    } else {
      item[prop]++; 
    }
  },
  isEmpty: function(arrProp) {
    const arr = obj.deep(this, arrProp) || arrProp;
    
    this.next(Array.isArray(arr) && !arr.length);
  },
  isArray: function(arrProp) {
    const item = obj.deep(this, arrProp) ||  arrProp;

    this.next(Array.isArray(item));
  },
  isString: function(item) {
    const constant = obj.deep(this, item);
    
    this.next(typeof constant == "string");
  },
  learn: function(res) {
    this.learn(res);
  },
  log: function(messageProp) {
    let message = obj.deep(this, messageProp);

    if (!message && message != 0) message = messageProp;

    console.log(message);
  },
  next: function(res, next) {
    next(res);
  },
  require: function(requiredProps) {
    const requiredArr = Array.from(arguments),
        required = requiredArr.slice(0, requiredArr.length-2),
        propsMissing = [];

    const checkForProp = (propToCheck) => {
      const { item, prop } = obj.tip(this, propToCheck),
          propInItem = !!item && prop in item;
          
      if(!propInItem) propsMissing.push(prop);
    };

    required.forEach(checkForProp);

    if(propsMissing.length) {
      this._error = "<(-_-)> Missing props you are: " + propsMissing.join(", ");
    }
  },
  restart: function(res, next) {
    const step = this._step,
        restart = () => step.firstStep().method(this);

    setTimeout(restart);
  },
  wait: function(time, next) {
    setTimeout(next, time * 1000);
  }
};