(function (globals) {
  class EmbeddedNetsBloxAPI extends EventTarget {
    constructor(element) {
      super();
      this.element = element;
      this._requests = {};
      this._listeners = {};
      this._actionListeners = [];

      const receiveMessage = (event) => {
        const data = event.data;
        const { type } = data;
        if (type === "reply") {
          const { id } = data;
          const request = this._requests[id];
          if (request) {
            request.resolve(data);
            delete this._requests[id];
          }
        } else if (type === "event") {
          const { eventType, detail } = data;
          this.dispatchEvent(new CustomEvent(eventType, { detail }));
        }
      };

      window.addEventListener("message", receiveMessage, false);
    }

    async getProjectXML() {
      const reqData = { type: "export-project" };
      const data = await this.reqReply(reqData);
      return data.xml;
    }

    async getUsername() {
      const reqData = { type: "get-username" };
      const data = await this.reqReply(reqData);
      return data.username;
    }

    async addActionListener(fn) {
      const callback = (event) => fn(event.detail);
      this._actionListeners.push([fn, callback]);
      await this.addEventListener("action", callback);
      return callback;
    }

    async removeActionListener(fn) {
      const index = this._actionListeners.findIndex((pair) => pair[0] === fn);
      const callback =
        index > -1 ? this._actionListeners.splice(index, 1).pop()[1] : null;
      return this.removeEventListener("action", callback);
    }

    async addEventListener(type, fn) {
      const listenerId = this.genUuid();
      this._listeners[listenerId] = fn;
      await this.reqReply({
        type: "add-listener",
        eventType: type,
        listenerId,
      });
      return super.addEventListener(type, fn);
    }

    async removeEventListener(type, fn) {
      const listenerId = Object.keys(this._listeners).find(
        (id) => this._listeners[id] === fn
      );

      await this.reqReply({
        type: "remove-listener",
        eventType: type,
        listenerId,
      });

      return super.removeEventListener(type, fn);
    }

    async import(name, content) {
      this.call({
        type: "import",
        name: name,
        content: content,
      });
    }

    async saveToCloud(name) {
      this.call({
        type: "save-cloud",
        name: name,
      });
    }

    async publishProject(name, publish) {
      this.call({
        type: "publish",
        name: name,
        publish: publish,
      });
    }

    async runProject() {
      this.call({
        type: "run-script",
      });
    }

    async getGlobalVariables() {
      const reqData = { type: "global-variables" };
      const data = await this.reqReply(reqData);
      return data.variables;
    }

    async getStageImage() {
      const reqData = { type: "stage-image" };
      const data = await this.reqReply(reqData);
      return data.stageImage;
    }

    async deleteProject(name) {
      this.call({
        type: "delete-project",
        name: name,
      });
    }

    genUuid() {
      return Date.now() + Math.floor(Math.random() * 1000);
    }

    reqReply(reqData) {
      const id = this.genUuid();
      const deferred = defer();
      this._requests[id] = deferred;
      reqData.id = id;
      this.call(reqData);

      setTimeout(() => {
        const deferred = this._requests[id];
        if (deferred) {
          deferred.reject(new Error("Timeout Exceeded"));
          delete this._requests[id];
        }
      }, 5000);

      return deferred.promise;
    }

    call(msgData) {
      this.element.contentWindow.postMessage(msgData, "*");
    }
  }

  function defer() {
    const deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });
    return deferred;
  }

  globals.EmbeddedNetsBloxAPI = EmbeddedNetsBloxAPI;
})(this);
