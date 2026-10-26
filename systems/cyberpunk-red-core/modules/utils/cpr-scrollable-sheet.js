const { HandlebarsApplicationMixin } = foundry.applications.api;

function readScrollPosition(element) {
  return { scrollTop: element.scrollTop, scrollLeft: element.scrollLeft };
}

/**
 * Preserve scroll state in CPR's single-form sheets, including nested editors.
 *
 * @param {typeof foundry.applications.api.ApplicationV2} Base the sheet class
 * @returns {typeof foundry.applications.api.ApplicationV2} the scrollable sheet
 */
export default function CPRScrollableSheetMixin(Base) {
  return class CPRScrollableSheet extends HandlebarsApplicationMixin(Base) {
    #scrollStates = new Map();

    #editorPositions = new Map();

    #savedEditorPositions = new WeakMap();

    #partListeners = new Map();

    #captureEditorPositions(partId, element) {
      const positions = this.#editorPositions.get(partId) ?? new Map();
      for (const editor of element.querySelectorAll("prose-mirror[name]")) {
        const content = editor.querySelector(".editor-content");
        const saved = this.#savedEditorPositions.get(editor);
        if (saved || content?.getClientRects().length) {
          positions.set(editor.name, saved ?? readScrollPosition(content));
        }
      }
      this.#editorPositions.set(partId, positions);
    }

    #restoreEditorPositions(partId, element) {
      const positions = this.#editorPositions.get(partId);
      if (!positions) return;
      for (const editor of element.querySelectorAll("prose-mirror[name]")) {
        const content = editor.querySelector(".editor-content");
        const position = positions.get(editor.name);
        if (position && content?.getClientRects().length) {
          Object.assign(content, position);
          positions.set(editor.name, readScrollPosition(content));
        }
      }
    }

    /** @override */
    _preSyncPartState(partId, newElement, priorElement, state) {
      super._preSyncPartState(partId, newElement, priorElement, state);

      // Custom elements create their children when connected. Their new
      // .editor-content nodes do not exist yet, so record the field name.
      this.#captureEditorPositions(partId, priorElement);
    }

    /** @override */
    _syncPartState(partId, newElement, priorElement, state) {
      this.#scrollStates.set(partId, { newElement, priorElement, state });
    }

    /** @override */
    async _postRender(context, options) {
      await super._postRender(context, options);

      // CPR's tab controllers activate their content during _onRender, after
      // Foundry's normal part-state restoration has already run.
      for (const [partId, { newElement, priorElement, state }] of this
        .#scrollStates) {
        super._syncPartState(partId, newElement, priorElement, state);
        this.#restoreEditorPositions(partId, newElement);
      }
      this.#scrollStates.clear();
    }

    /** @override */
    _attachPartListeners(partId, element, options) {
      super._attachPartListeners(partId, element, options);

      this.#partListeners.get(partId)?.abort();
      const controller = new AbortController();
      this.#partListeners.set(partId, controller);

      // Cache the visible tab before Tabs hides it. Read hidden editors only
      // after activation; their zero-sized boxes must not erase saved offsets.
      element.addEventListener(
        "click",
        (event) => {
          if (event.target.closest(".cpr-tabs [data-tab]")) {
            this.#captureEditorPositions(partId, element);
          }
        },
        { capture: true, signal: controller.signal },
      );
      element.addEventListener(
        "click",
        (event) => {
          if (event.target.closest(".cpr-tabs [data-tab]")) {
            this.#restoreEditorPositions(partId, element);
          }
        },
        { signal: controller.signal },
      );

      for (const editor of element.querySelectorAll("prose-mirror[name]")) {
        const { signal } = controller;
        let position;
        let saving = false;
        const capture = () => {
          const content = editor.querySelector(".editor-content");
          if (content) position = readScrollPosition(content);
        };
        const restore = () => {
          const content = editor.querySelector(".editor-content");
          if (position && content) Object.assign(content, position);
          position = undefined;
        };

        // Opening and saving move the editor content into/out of a wrapper.
        // Capture before that happens, including saves with no document change.
        editor.addEventListener(
          "click",
          (event) => {
            if (event.target.closest("button.toggle")) capture();
          },
          { capture: true, signal },
        );
        editor.addEventListener("open", restore, { signal });
        editor.addEventListener(
          "save",
          () => {
            capture();
            saving = true;
          },
          { signal },
        );
        editor.addEventListener(
          "change",
          () => {
            // Closing briefly shows the old enriched HTML. Preserve the save's
            // offset if that shorter old content clamps before the update arrives.
            if (saving && position)
              this.#savedEditorPositions.set(editor, position);
          },
          { signal },
        );
        editor.addEventListener(
          "close",
          () => {
            restore();
            saving = false;
          },
          { signal },
        );
      }
    }

    /** @override */
    _tearDown(options) {
      for (const controller of this.#partListeners.values()) controller.abort();
      this.#partListeners.clear();
      this.#scrollStates.clear();
      this.#editorPositions.clear();
      this.#savedEditorPositions = new WeakMap();
      super._tearDown(options);
    }
  };
}
