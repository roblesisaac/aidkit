import { convert, getArgNames, getArgs, obj, type } from "./utils.js";
import Memory from "./memory.js";
import globalSteps from "./globalSteps.js";

function Aid(blueprint) {
  const instruct = blueprint.instruct;

  const getStep = function(sIndex, args, steps) {
    steps = steps || this.steps(args);
    
    return steps.index == sIndex || steps.missingIndex
      ? steps
      : getStep(sIndex, args, steps.nextStep() || { missingIndex: sIndex });
  };

  const buildSteps = function(stepsArr, aid, aidName, prev, stepIndex, specialProp) {
    if (!stepsArr || !stepsArr.length || stepIndex == stepsArr.length) {
      return;
    }
  
    const index = stepIndex || 0,
        stepPrint = stepsArr[index],
        isObj = type.isObject(stepPrint),
        specials = aid._library.specials;
  
    const methodName = typeof stepPrint == "string"
          ? stepPrint
          : type.isObject(stepPrint)
          ? Object.keys(stepPrint)[0]
          : typeof stepPrint == "function" && specials.includes(stepPrint.name)
          ? "function"
          : stepPrint.name || typeof stepPrint;
          
    const isSpecial = specials.includes(methodName),
        isFinalStep = stepsArr.length == index+1,
        isVariation = !!aid[methodName] || methodName == "aidMethod";
  
    const buildSub = function(index, sProp, instructs, previous) {
      instructs = instructs || stepsArr;
      previous = previous || this;
      sProp = sProp || specialProp;
      return buildSteps(instructs, aid, aidName, previous, index, sProp);
    };
  
    return {
      aid,
      aidName,
      isFinalStep,
      isSpecial,
      isVariation,
      index,
      methodName,
      prev,
      specialProp,
      stepPrint,
      init: function() {
        if(!isSpecial) {
          return this;
        }
        
        const special = this[methodName] = {},
              formatSpecialInstructions = specialArr => convert.toArray(specialArr).flat();

        Object.keys(stepPrint).forEach((sProp) => {
          const formattedInstructions = formatSpecialInstructions(stepPrint[sProp]);
          
          special[sProp] = buildSub(0, sProp, formattedInstructions, prev);
        });
  
        return this;
      },
      firstStep: function() {
        const { prev } = this;

        return prev ?
          prev.firstStep() :
          this;
      },
      nextStep: function() {
        return buildSub.call(this, index + 1);
      },
      handleError: function(memory, error) {
        const { _rej, _aidName } = memory,
            { _catch } = aid;   
        
        const errMessage = {
          error,
          methodName,
          aidName,
          _aidName,
          prev,
          stepPrint
        };
        
        const errMethod = _catch ? _catch[_aidName] || _catch : console.log;
        
        if (errMethod && typeof errMethod == "function") {
          errMethod.call(memory, errMessage);
          return;
        }
  
        console.error(errMessage);
        return;
      },
      method: function(memory, rabbitTrail, parentSpecial) {
        const { nextStep, handleError } = this;
  
        const method = aid[methodName] || aid._steps[methodName] || stepPrint,
            theSpecialProp = specialProp || parentSpecial,
            updater = theSpecialProp == "if" ? "_condition" : "_args";
            
        const relayLast = function(args) {
          const output = args[0];
          
          if (theSpecialProp && memory._conditions) {
            memory._conditions.push(output);
            return;
          }
          
          memory[updater] = Array.from(args);
          if(updater == "_args") memory._addTools({ output });
        };
        
        const resolvePromise = function(output=[]) {      
          const resolve = rabbitTrail || memory._resolve.shift();
  
          if (typeof resolve != "function") {
            return;
          }
          
          resolve(output[0]);
        };
  
        const next = function(res) {
          if(arguments.length) relayLast(arguments);
  
          if (isFinalStep || memory._endAll) {
            resolvePromise(memory[updater]);
            return;
          }
          
          nextStep.call(this).method(memory, rabbitTrail, parentSpecial);
        }.bind(this)
  
        const learn = function(res) {
          memory._remember(res);
          next(res);
        };
  
        const setupArgs = function() {
          let arr = isObj && !isSpecial 
                ? stepPrint[methodName]
                : memory[updater];
                
          arr = convert.toArray(arr);
          
          return arr.concat([next, learn]);
        };
  
        const stepData = function() {
          if (!isObj || isSpecial) {
            return {};
          }
  
          const printCopy = obj.copy(stepPrint);
  
          for (const i in arguments) {
            delete printCopy[arguments[i]];
          }
          
          return printCopy;
        };
  
        const { _output, _error } = memory,
        _errorMessage = _output ? _output._error : _error;
          
        if(_errorMessage) {
          handleError(memory, _errorMessage);
          return;
        }
  
        if (isVariation) {
          method(memory, specialProp, !aid[methodName]).then(next);
          return;
        }
  
        if (methodName == "boolean") {
          memory[updater] = stepPrint;
          return next();
        }
  
        if (typeof method != "function") {
          memory._remember(stepData());
          return next();
        }
  
        const args = setupArgs(),
            data = stepData(methodName),
            autoCompletes = method.toString().includesAny("next", "_learn", "return;");
  
        try {
          memory
            ._import(data)
            ._addTools({ step: this, next, learn });

          method.apply(memory, args);
        } catch (error) {
          handleError(memory, error.toString());
          return;
        }
  
        if (!autoCompletes) {
          next();
        }
      }
    }.init();
  };

  const buildWithSpecialArgs = function(aidMethod) {
    return function() {
      const specialArgs = arguments;
      
      return function (res, next) {
        const { _step } = this,
            { specialProp, aid, methodName } = _step;
        
        aidMethod(this, specialProp, !!aid[methodName], specialArgs).then(next);
      };
    };
  };

  const buildAidMethod = function(instructions, aid, aidName) {
    const getSteps = function(args) {
      const stepsArr = convert.toInstruct(instructions, args);
      return buildSteps(stepsArr, aid, aidName);
    };

    function aidMethod(memory, parentSpecial, aidIsForeign, specialArgs) {
      const args = arguments;
      
      function getMemory(resolve, rej) {
        resolve = [resolve];

        if (memory && memory._isMemory) {
          memory._resolve = resolve.concat(memory._resolve);

          if (aidIsForeign || memory._args && memory._args[1]) {
            memory._absorb(aid);
          }

          if (specialArgs) {
            return memory._importSpecialArgs(instructions, specialArgs);
          }

          return memory._unshiftArgs(instructions);
        }

        return new Memory(aid)
          ._importArgs(instructions, args)
          ._addTools({ resolve, rej, aidName, args: [args] });
      }
      
      return new Promise(function(resolve, reject) {
        const memry = getMemory(resolve, reject),
            args = memry._args,
            arg = args[1] ? args.shift() : args[0],
            steps = getSteps(arg);
            
        steps.method(memry, null, parentSpecial);
      });
    };

    aidMethod.steps = getSteps;
    aidMethod.step = getStep;
    aidMethod._import = function() {
      const memory = new Memory(aid)._import(...arguments);

      return (...args) => aidMethod(memory, null, null, args);
    };

    return aidMethod;
  }

  const assignAid = (instruct, aidName) => {
    const instructions = instruct[aidName] || instruct,
          method = buildAidMethod(instructions, this, aidName);

    obj.assignNative(this, aidName+"_", buildWithSpecialArgs(method));
    obj.assignNative(this, aidName, method);
  };

  const assignNativeKeys = (natives) => {
    Object.keys(natives).forEach(prop => {
      obj.assignNative(this, prop, natives[prop])
    });
  }

  const _library = {
    specials: ["if", "each", "setup"],
    steps: globalSteps
  };

  assignNativeKeys({
    _blueprint: obj.copy(blueprint),
    _catch: blueprint.catch ? obj.copy(blueprint.catch) : null,
    _library,
    _steps: Object.assign({}, _library.steps, blueprint.steps)
  });

  if (!type.isObject(instruct)) {
    assignAid(instruct, "run");
    return;
  }

  for (const vName in instruct) {
    assignAid(instruct, vName);
  }
}

export { Memory, Aid, convert, globalSteps, getArgNames, getArgs, obj, type };