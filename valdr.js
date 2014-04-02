/**
 * valdr - v0.0.1-alpha-2 - 2014-04-03
 * https://github.com/netceteragroup/valdr
 * Copyright (c) 2014 Netcetera AG
 * License: MIT
 */
(function (window, document) {
'use strict';

angular.module('valdr', ['ng'])
  .constant('valdrEvents', {
    'revalidate': 'valdr-revalidate'
  })
  .value('valdrClasses', {
    'valid': 'has-success',
    'invalid': 'has-error'
  });
angular.module('valdr')

  /**
   * Exposes utility functions used in validators and valdr core.
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
       * @param value the value
       * @returns {boolean} true if the given value is not null, not undefined, not an empty string and not NaN
       */
      notEmpty: function (value) {
        return angular.isDefined(value) && value !== '' && value !== null && !this.isNaN(value);
      },

      /**
       * @param value the value to validate
       * @returns {boolean} true if the given value is null, undefined, an empty string or NaN
       */
      isEmpty: function (value) {
        return !this.notEmpty(value);
      }
    };
  })
;
angular.module('valdr')

  .factory('requiredValidator', ['valdrUtil', function (valdrUtil) {
    return {
      name: 'Required',

      /**
       * Checks if the value is not empty.
       *
       * @param value the value to validate
       * @returns {boolean} true if the value is not empty
       */
      validate: function (value) {
        return valdrUtil.notEmpty(value);
      }
    };
  }]);

angular.module('valdr')

  .factory('minValidator', ['valdrUtil', function (valdrUtil) {

    return {
      name: 'Min',

      /**
       * Checks if the value is a number and higher or equal as the value specified in the constraint.
       *
       * @param value the value to validate
       * @param constraint the validation constraint
       * @returns {boolean} true if valid
       */
      validate: function (value, constraint) {
        var minValue = Number(constraint.value),
            valueAsNumber = Number(value);

        return valdrUtil.isEmpty(value) ||
            (!valdrUtil.isNaN(valueAsNumber) && valueAsNumber >= minValue);
      }
    };
  }]);

angular.module('valdr')

  .factory('maxValidator', ['valdrUtil', function (valdrUtil) {

    return {
      name: 'Max',

      /**
       * Checks if the value is a number and lower or equal as the value specified in the constraint.
       *
       * @param value the value to validate
       * @param constraint the validation constraint
       * @returns {boolean} true if valid
       */
      validate: function (value, constraint) {
        var maxValue = Number(constraint.value),
            valueAsNumber = Number(value);

        return valdrUtil.isEmpty(value) ||
            (!valdrUtil.isNaN(valueAsNumber) && valueAsNumber <= maxValue);
      }
    };
  }]);

angular.module('valdr')

  .factory('sizeValidator', function () {
    return {
      name: 'Size',

      /**
       * Checks if the values length is in the range specified by the constraints min and max properties.
       *
       * @param value the value to validate
       * @param constraint with optional values: min, max
       * @returns {boolean} true if valid
       */
      validate: function (value, constraint) {
        var minLength = constraint.min || 0,
          maxLength = constraint.max;

        value = value || '';
        return value.length >= minLength &&
          (maxLength === undefined || value.length <= maxLength);
      }
    };
  });

angular.module('valdr')

  .factory('emailValidator', ['valdrUtil', function (valdrUtil) {

    // the e-mail pattern used in angular.js
    var EMAIL_REGEXP = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-z0-9-]+(\.[a-z0-9-]+)*$/i;

    return {
      name: 'Email',

      /**
       * Checks if the value is a valid email address.
       *
       * @param value the value to validate
       * @returns {boolean} true if valid
       */
      validate: function (value) {
        return valdrUtil.isEmpty(value) || EMAIL_REGEXP.test(value);
      }
    };
  }]);

angular.module('valdr')

  .provider('valdr', function () {

    var constraints = {}, validators = {}, constraintUrl, constraintsLoading, constraintAliases = {},
      validatorNames = [
        'requiredValidator',
        'sizeValidator',
        'minValidator',
        'maxValidator',
        'emailValidator'
      ];

    var addConstraints = function (newConstraints) {
      angular.extend(constraints, newConstraints);
    };

    this.addConstraints = addConstraints;

    this.setConstraintUrl = function (url) {
      constraintUrl = url;
    };

    this.addValidator = function (validatorName) {
      validatorNames.push(validatorName);
    };

    this.addConstraintAlias = function (valdrName, customName) {
      constraintAliases[valdrName] = customName;
    };

    this.$get =
      ['$log', '$injector', '$rootScope', '$http', 'valdrEvents', 'valdrUtil', 'valdrClasses',
      function($log, $injector, $rootScope, $http, valdrEvents, valdrUtil, valdrClasses) {

      // inject all validators
      angular.forEach(validatorNames, function(validatorName) {
        var validator = $injector.get(validatorName);
        var constraintName = constraintAliases[validator.name] || validator.name;
        validators[constraintName] = validator;
      });

      // load constraints via $http if constraintUrl is configured
      if (constraintUrl) {
        constraintsLoading = true;
        $http.get(constraintUrl).then(function (response) {
          constraintsLoading = false;
          addConstraints(response.data);
          $rootScope.$broadcast(valdrEvents.revalidate);
        }).finally(function () {
          constraintsLoading = false;
        });
      }

      var constraintsForType = function (type) {
        if (valdrUtil.has(constraints, type)) {
          return constraints[type];
        } else if (!constraintsLoading) {
          $log.warn('No constraints for type \'' + type + '\' available.');
        }
      };

      return {
        /**
         * Validates the value of the given type with the constraints for the given field name.
         *
         * @param typeName the type name
         * @param fieldName the field name
         * @param value the value to validate
         * @returns {*}
         */
        validate: function (typeName, fieldName, value) {

          var validResult = { valid: true },
              typeConstraints = constraintsForType(typeName);

          if (valdrUtil.has(typeConstraints, fieldName)) {
            var fieldConstraints = typeConstraints[fieldName],
                fieldIsValid = true,
                violations = [];

            angular.forEach(fieldConstraints, function (constraint, validatorName) {
              var validator = validators[validatorName];

              if (angular.isUndefined(validator)) {
                $log.warn('No validator defined for \'' + validatorName +
                  '\'. Can not validate field \'' + fieldName + '\'');
                return validResult;
              }

              var valid = validator.validate(value, constraint);
              if (!valid) {
                var violation = {
                  value: value,
                  field: fieldName,
                  validator: validatorName
                };
                angular.extend(violation, constraint);
                violations.push(violation);
              }
              fieldIsValid = fieldIsValid && valid;
            });

            return {
              valid: fieldIsValid,
              violations: violations.length === 0 ? undefined : violations
            };
          } else {
            return validResult;
          }
        },
        addConstraints: function (newConstraints) {
          addConstraints(newConstraints);
          $rootScope.$broadcast(valdrEvents.revalidate);
        },
        getConstraints: function () {
          return constraints;
        },
        setClasses: function (newClasses) {
          angular.extend(valdrClasses, newClasses);
          $rootScope.$broadcast(valdrEvents.revalidate);
        }
      };
    }];
  });
angular.module('valdr')

  /**
   * The valdrType directive defines the type of the model to be validated.
   * The directive exposes the type through the controller to allow access to it by wrapped directives.
   */
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

  /**
   * This directive adds validation to all input fields which are bound to an ngModel and are surrounded
   * by a valdrType directive.
   */
  .directive('input',
    ['valdrEvents', 'valdr', 'valdrUtil', 'valdrClasses', function (valdrEvents, valdr, valdrUtil, valdrClasses) {
    return  {
      restrict: 'E',
      require: ['?^valdrType', '?^ngModel'],
      link: function (scope, element, attrs, controllers) {

        var valdrTypeController = controllers[0],
          ngModelController = controllers[1],
          fieldName = attrs.name,
          parentElement = element.parent();

        // Stop right here if this is an <input> that's either not inside of a valdr-type block
        // or there is no ng-model bound to it.
        if (!valdrTypeController || !ngModelController) {
          return;
        }

        if (valdrUtil.isEmpty(fieldName)) {
          throw new Error('input is not bound to a field name');
        }

        var updateClassOnParentElement = function(valid) {
          parentElement.addClass(valid ? valdrClasses.valid : valdrClasses.invalid);
          parentElement.removeClass(valid ? valdrClasses.invalid :  valdrClasses.valid);
        };

        var updateNgModelController = function (validationResult) {
          ngModelController.$setValidity('valdr', validationResult.valid);
          ngModelController.valdrViolations = validationResult.violations;
        };

        var validate = function (value) {
          var validationResult = valdr.validate(valdrTypeController.getType(), fieldName, value);
          updateNgModelController(validationResult);
          updateClassOnParentElement(validationResult.valid);
          return validationResult.valid ? value : undefined;
        };

        ngModelController.$parsers.push(validate);
        ngModelController.$formatters.push(validate);

        scope.$on(valdrEvents.revalidate, function () {
          validate(ngModelController.$viewValue);
        });
      }
    };
  }]);
})(window, document);
