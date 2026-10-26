export default class MigrationError extends Error {
  /**
   * Extend the base Error class with information
   * related to the failed migration.
   *
   * @param {Object} data - extra data associated with this error
   * @param {string} message - the error message
   * @param {Object} options - additional options
   * @override
   */
  constructor(data, message, options) {
    super(message, options);
    this.name = "MigrationError";
    this.type = options.type || "MigrationScriptError";
    const { DataModelValidationError } = foundry.data.validation;
    if (options.cause instanceof DataModelValidationError) {
      this.type = "DataModelValidationError";
    }

    this.data = data;

    // Set migration data.
    const runner = game.cpr.MigrationRunner;
    this.data.migrationData = {
      MigrationScript: runner.currentMigration,
      currentVersion: runner.currentDataModelVersion,
      newVersion: runner.newDataModelVersion,
      errorPhase: null, // This is applied in the migration app.
    };

    this.data.message = this.message;
    this.data.originError = {
      message: options.cause?.message,
      stack: this.sanitizeStackTrace(options.cause?.stack || ""),
    };
    this.data.stack = this.sanitizeStackTrace(this.stack || "");
  }

  /**
   * Sanitize the stack trace of an error by removing the
   * user's host information.
   *
   * @param {string} trace - The error's stack trace.
   * @returns {string} - The sanitized stack trace.
   */
  // eslint-disable-next-line class-methods-use-this
  sanitizeStackTrace(trace) {
    return trace.replace(
      /\b(https?|wss?):\/\/([^/:]+)(:\d+)?/g,
      (match, protocol, host, port) => {
        return `${protocol}://host${port || ""}`;
      },
    );
  }
}
