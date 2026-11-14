'use strict';
const client = import('./core.mjs');
module.exports = function (RED) {
  function SiftingIOHistorical(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    node.on('input', async function (msg, send, done) {
      send = send || function (value) { node.send(value); };
      done = done || function (error) { if (error) node.error(error); };
      try {
        const {readHistorical,toCsv} = await client;
        const key = node.credentials?.apiKey || process.env.SIFTINGIO_API_KEY;
        const page = await readHistorical(key, msg.payload);
        // Fresh objects deliberately discard any incoming headers/transport fields.
        send([{_msgid:msg._msgid,payload:page},{_msgid:msg._msgid,payload:toCsv(page),filename:'siftingio-historical-bars.csv'}]);
        done();
      } catch (error) {
        done(new Error(error instanceof Error ? error.message : 'Market-data request failed.'));
      }
    });
  }
  RED.nodes.registerType('siftingio historical',SiftingIOHistorical,{credentials:{apiKey:{type:'password'}}});
};
