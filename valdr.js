/**
 * valdr - v0.0.1-alpha - 2014-03-22
 * https://github.com/netceteragroup/valdr
 * Copyright (c) 2014 Netcetera AG
 * License: MIT
 */
(function (window, document) {
'use strict';

angular.module('valdr', ['ng'])
  .constant('valdrEvents', {
    'rulesChanged': 'nca-model-validation-rules-changed'
  });
angular.module('valdr')

/**
 * Exposes util functions for dependency injection.
 */
  .factory('valdrUtil', function () {
    return {
      isNaN: function (value) {
        // `NaN` as a primitive is the only value that is not equal to itself
        // (perform the [[Class]] check first to avoid errors with some host objects in IE)
        return this.isNumber(value) && value !== +value;
      },

      isNumber: function (value) {
        var type = typeof value;
        return type === 'number' ||
          value && type === 'object' && Object.prototype.toString.call(value) === '[object Number]' || false;
      },

      has: function (object, key) {
        return object ? Object.prototype.hasOwnProperty.call(object, key) : false;
      },

      /**
       * Iterates over own enumerable properties of an object executing the callback
       * for each property. The callback is bound to `thisArg` and invoked with three
       * arguments; (property, value).
       *
       * @static
       * @memberOf _
       * @category Objects
       * @param {Object} object The object to iterate over.
       * @param {Function} [callback=identity] The function called per iteration.
       * @example
       *
       * forOwn({ '0': 'zero', '1': 'one', 'length': 2 }, function(property, value) {
       *   console.log(property);
       * });
       * // => logs '0', '1', and 'length' (property order is not guaranteed across environments)
       */
      forOwn: function (object, callback) {
        var name;
        for (name in object) {
          if (object.hasOwnProperty(name)) {
            callback(name, object[name]);
          }
        }
      }
    };
  })
;
angular.module('valdr')

  .factory('validationUtil', ['valdrUtil', function (valdrUtil) {
    return {

      /**
       * @param value the value to validate
       * @returns (boolean) true if the given value is not null, not undefined and not NaN
       */
      notNull: function (value) {
        return angular.isDefined(value) && value !== '' && value !== null && !valdrUtil.isNaN(value);
      },

      /**
       * Creates a validation result.
       * @param valid validity of field
       * @param messageKey the message key
       * @param messageParams the message parameters
       */
      result: function (valid, messageKey, messageParams) {
        return {
          valid: valid,
          messageKey: messageKey,
          messageParams: messageParams
        };
      }
    };
  }]);

angular.module('valdr')

  .factory('requiredValidator', ['validationUtil', function (validationUtil) {
    return {
      name: 'Required',

      /**
       * @param config no config is required for this validator
       * @param value the value to validate
       * @returns (object) validation result
       */
      validate: function (config, value) {
        var valid = validationUtil.notNull(value);
        return validationUtil.result(valid, config.message);
      }
    };
  }]);

angular.module('valdr')

  .factory('sizeValidator', ['validationUtil', function (validationUtil) {
    return {
      name: 'Size',

      /**
       * @param config optional values: min, max
       * @param value the value to validate
       * @returns (object) validation result
       */
      validate: function (config, value) {
        var minLength = config.min || 0,
          maxLength = config.max;

        value = value || '';

        var valid = value.length >= minLength &&
          (maxLength === undefined || value.length <= maxLength);

        var params = { min: minLength, max: maxLength };
        return validationUtil.result(valid, config.message, params);
      }
    };
  }]);

angular.module('valdr')

  .provider('valdrValidator', function () {

    var validationRules = {}, validators = {}, validatorNames = [], validationRulesUrl;

    var addValidationRules = function (newValidationRules) {
      angular.extend(validationRules, newValidationRules);
    };

    this.addValidationRules = addValidationRules;

    this.setValidationRulesUrl = function (url) {
      validationRulesUrl = url;
    };

    this.addValidator = function (validatorName) {
      validatorNames.push(validatorName);
    };

    this.addValidator('sizeValidator');
    this.addValidator('requiredValidator');

    this.$get =
      ['$log', '$injector', '$rootScope', '$http', 'valdrEvents', 'valdrUtil',
      function($log, $injector, $rootScope, $http, valdrEvents, valdrUtil) {

      angular.forEach(validatorNames, function(validatorName) {
        var validator = $injector.get(validatorName);
        validators[validator.name] = validator;
      });

      if (validationRulesUrl) {
        $http.get(validationRulesUrl).then(function (response) {
          addValidationRules(response.data);
          $rootScope.$broadcast(valdrEvents.rulesChanged);
        });
      }

      var getValidationRulesForType = function (typeName) {
        if (!valdrUtil.has(validationRules, typeName)) {
          $log.warn('No validation rules for type ' + typeName + ' available.');
          return;
        }
        return validationRules[typeName];
      };

      var valid = { valid: true };

      return {
        /**
         * Validates the value of the given type with the validation rules for the given field name.
         * @param typeName the type name
         * @param fieldName the field name
         * @param value the value to validate
         * @returns {*}
         */
        validate: function (typeName, fieldName, value) {

          var validationRules = getValidationRulesForType(typeName);
          if (valdrUtil.has(validationRules, fieldName)) {
            var fieldValidationRules = validationRules[fieldName],
                isValid = true,
                validationMessages = [];

            valdrUtil.forOwn(fieldValidationRules, function (validatorName, validationRules) {

              var validator = validators[validatorName];
              if (angular.isUndefined(validator)) {
                $log.warn('No validator defined for \'' + validatorName + '\'. Can not validate field ' + fieldName);
                return valid;
              }

              var validationResult = validators[validatorName].validate(validationRules, value);
              if (!validationResult.valid) {
                validationMessages.push(validationResult);
              }
              isValid = isValid && validationResult.valid;
            });

            return {
              valid: isValid,
              messages: validationMessages
            };
          } else {
            return valid;
          }
        },
        addValidationRules: function (newValidationRules) {
          addValidationRules(newValidationRules);
          $rootScope.$broadcast(valdrEvents.rulesChanged);
        },
        getValidationRules: function () {
          return validationRules;
        }
      };
    }];
  });
angular.module('valdr')

  .directive('valdrType', function () {
    return  {
      controller: function() {
        var type;

        this.setType = function (newType) {
          type = newType;
        };

        this.getType = function () {
          return type;
        };
      },
      priority: 1,
      link: function (scope, element, attrs, controller) {
        controller.setType(attrs.valdrType);
      }
    };
  });

angular.module('valdr')

  .directive('input',
    ['valdrEvents', 'valdrValidator', function (valdrEvents, valdrValidator) {
    return  {
      restrict: 'E',
      require: ['?^valdrType', '?^ngModel'],
      link: function (scope, element, attrs, controllers) {

        var valdrTypeController = controllers[0],
          ngModelController = controllers[1],
          fieldName = attrs.name;

        // Stop right here if this is an <input> that's either not inside of a valdr-type block
        // or there is no ng-model bound to it.
        if (!valdrTypeController || !ngModelController) {
          return;
        }

        if (!angular.isString(fieldName) || fieldName.length === 0) {
          throw new Error('input is not bound to a field name');
        }

        var setValidityAndMessages = function (validationResult) {
          ngModelController.$setValidity('valdrValidator', validationResult.valid);
          ngModelController.valdrMessages = validationResult.messages;
        };

        var validate = function (value) {
          var validationResult = valdrValidator.validate(valdrTypeController.getType(), fieldName, value);
          setValidityAndMessages(validationResult);
          return validationResult.valid ? value : undefined;
        };

        ngModelController.$parsers.push(validate);
        ngModelController.$formatters.push(validate);

        scope.$on(valdrEvents.rulesChanged, function () {
          validate(ngModelController.$viewValue);
        });
      }
    };
  }]);
})(window, document);