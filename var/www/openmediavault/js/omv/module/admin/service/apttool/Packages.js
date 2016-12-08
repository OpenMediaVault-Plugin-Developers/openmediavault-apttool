/**
 * @license   http://www.gnu.org/licenses/gpl.html GPL Version 3
 * @author    Volker Theile <volker.theile@openmediavault.org>
 * @author    OpenMediaVault Plugin Developers <plugins@omv-extras.org>
 * @copyright Copyright (c) 2009-2013 Volker Theile
 * @copyright Copyright (c) 2016 OpenMediaVault Plugin Developers
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// require("js/omv/WorkspaceManager.js")
// require("js/omv/workspace/grid/Panel.js")
// require("js/omv/workspace/window/Form.js")
// require("js/omv/workspace/window/plugin/ConfigObject.js")
// require("js/omv/Rpc.js")
// require("js/omv/data/Store.js")
// require("js/omv/data/Model.js")
// require("js/omv/data/proxy/Rpc.js")

Ext.define("OMV.module.admin.service.apttool.Package", {
    extend : "OMV.workspace.window.Form",
    uses   : [
        "OMV.workspace.window.plugin.ConfigObject"
    ],

    rpcService   : "AptTool",
    rpcGetMethod : "getPackage",
    rpcSetMethod : "setPackage",
    plugins      : [{
        ptype : "configobject"
    }],

    getFormItems : function () {
        var me = this;
        return [{
            xtype      : "textfield",
            name       : "packagename",
            fieldLabel : _("package Name"),
            allowBlank : false
        },{
            xtype      : "checkbox",
            name       : "backports",
            fieldLabel : _("Backports?"),
            checked    : false
        },];
    }
});

Ext.define("OMV.module.admin.service.apttool.Packages", {
    extend   : "OMV.workspace.grid.Panel",
    requires : [
        "OMV.Rpc",
        "OMV.data.Store",
        "OMV.data.Model",
        "OMV.data.proxy.Rpc"
    ],
    uses     : [
        "OMV.module.admin.service.apttool.Package"
    ],

    hidePagingToolbar : false,
    hideEditButton    : true,
    stateful          : true,
    stateId           : "c889057b-b2c0-dc48-e4c1-8b9b41b14d7b",
    columns           : [{
        text      : _("Package Name"),
        sortable  : true,
        dataIndex : "packagename",
        stateId   : "packagename"
    },{
        xtype     : "booleaniconcolumn",
        header    : _("Backports"),
        sortable  : true,
        dataIndex : "backports",
        align     : "center",
        width     : 80,
        resizable : false,
        trueIcon  : "switch_on.png",
        falseIcon : "switch_off.png"
    },{
        text      : _("Installed"),
        sortable  : true,
        dataIndex : "installed",
        stateId   : "installed"
    }],

    initComponent : function () {
        var me = this;
        Ext.apply(me, {
            store : Ext.create("OMV.data.Store", {
                autoLoad : true,
                model    : OMV.data.Model.createImplicit({
                    idProperty : "uuid",
                    fields     : [
                        { name  : "uuid", type: "string" },
                        { name  : "packagename", type: "string" },
                        { name  : "backports", type: "string" },
                        { name  : "installed", type: "string" }
                    ]
                }),
                proxy    : {
                    type    : "rpc",
                    rpcData : {
                        service : "AptTool",
                        method  : "getPackageList"
                    }
                }
            })
        });
        me.callParent(arguments);
    },

    getTopToolbarItems : function() {
        var me = this;
        var items = me.callParent(arguments);
        Ext.Array.push(items, {
            id       : me.getId() + "-tool",
            xtype    : "button",
            text     : _("Tools"),
            scope    : this,
            icon     : "images/software.png",
            disabled : true,
            selectionConfig : {
                minSelections : 1,
                maxSelections : 1
            },
            menu     : [{
                text     : _("Install"),
                icon     : "images/add.png",
                handler  : Ext.Function.bind(me.onToolsButton, me, [ "install" ])
            },{
                text     : _("Remove"),
                icon     : "images/delete.png",
                handler  : Ext.Function.bind(me.onToolsButton, me, [ "remove" ])
            }]
        });
        return items;
    },

    onAddButton: function () {
        var me = this;
        Ext.create("OMV.module.admin.service.apttool.Package", {
            title     : _("Add package"),
            uuid      : OMV.UUID_UNDEFINED,
            listeners : {
                scope  : me,
                submit : function () {
                    this.doReload();
                }
            }
        }).show();
    },

    doDeletion: function (record) {
        var me = this;
        OMV.Rpc.request({
            scope    : me,
            callback : me.onDeletion,
            rpcData  : {
                service : "AptTool",
                method  : "deletePackage",
                params  : {
                    uuid: record.get("uuid")
                }
            }
        });
    },

    onToolsButton : function(cmd) {
        var me = this;
        var title = "";
        var record = me.getSelected();
        switch(cmd) {
            case "install":
                title = _("Installing package ") + record.get("packagename") + " ...";
                break;
            case "remove":
                title = _("Removing package ") + record.get("packagename") + " ...";
                break;
        }
        var wnd = Ext.create("OMV.window.Execute", {
            title      : title,
            rpcService : "AptTool",
            rpcMethod  : "doCommand",
            rpcParams  : {
                "command"     : cmd,
                "packagename" : record.get("packagename"),
                "backports"   : record.get("backports")
            },
            rpcIgnoreErrors : true,
            hideStartButton : true,
            hideStopButton  : true,
            listeners       : {
                scope     : me,
                finish    : function(wnd, response) {
                    wnd.appendValue(_("Done..."));
                    wnd.setButtonDisabled("close", false);
                },
                exception : function(wnd, error) {
                    OMV.MessageBox.error(null, error);
                    wnd.setButtonDisabled("close", false);
                },
                close     : function() {
                    this.doReload();
                }
            }
        });
        wnd.setButtonDisabled("close", true);
        wnd.show();
        wnd.start();
    }
});

OMV.WorkspaceManager.registerPanel({
    id        : "packages",
    path      : "/service/apttool",
    text      : _("Packages"),
    position  : 10,
    className : "OMV.module.admin.service.apttool.Packages"
});
