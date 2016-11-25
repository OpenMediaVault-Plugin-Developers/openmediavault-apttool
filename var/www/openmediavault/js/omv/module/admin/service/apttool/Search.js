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
// require("js/omv/Rpc.js")
// require("js/omv/WorkspaceManager.js")
// require("js/omv/data/Store.js")
// require("js/omv/data/Model.js")
// require("js/omv/data/proxy/Rpc.js")
// require("js/omv/workspace/grid/Panel.js")

Ext.define("OMV.module.admin.service.apttool.Search", {
    extend   : "OMV.workspace.grid.Panel",
    requires : [
        "OMV.Rpc",
        "OMV.data.Store",
        "OMV.data.Model",
        "OMV.data.proxy.Rpc"
    ],

    term : "",
    type : "search",
    
    hidePagingToolbar : false,
    hideAddButton     : true,
    hideEditButton    : true,
    hideDeleteButton  : true,
    stateful          : true,
    stateId           : "bdb1c917-2ed1-4f59-c67f-bc2ef3ab2a5a",

    columnsTpl : [{
        text      : _("Package Name"),
        sortable  : false,
        dataIndex : "packagename",
        stateId   : "packagename",
        flex      : 1
    }],

    initComponent : function() {
        var me = this;
        Ext.apply(me, {
            columns : Ext.clone(me.columnsTpl),
            store   : me.createStore()
        });
        me.callParent(arguments);
    },

    createStore: function() {
        var me = this;
        return Ext.create("OMV.data.Store", {
            autoLoad : true,
            model    : OMV.data.Model.createImplicit({
                idProperty : "packagename",
                fields     : [
                    { name  : "packagename" }
                ]
            }),
            proxy : {
                type    : "rpc",
                rpcData : {
                    service : "AptTool",
                    method  : "executeSearch"
                },
                appendSortParams: true,
                extraParams : {
                    term : me.term,
                    type : me.type
                }
            }
        });
    },

    getTopToolbarItems : function() {
        var me = this;
        var items = me.callParent(arguments);

        Ext.Array.insert(items, 0, [{
            xtype     : "textfield",
            value     : this.term,
            listeners : {
                scope  : me,
                change : function(combo, value) {
                    this.term = value;
                },
                specialkey : function(field, e) {
                    if (e.getKey() == e.ENTER) {
                        me.onSearchButton();
                    }
                }
            }
        },{
            xtype   : "button",
            text    : _("Search"),
            icon    : "images/search.png",
            iconCls : Ext.baseCSSPrefix + "btn-icon-16x16",
            handler : Ext.Function.bind(me.onSearchButton, me, [ "search" ]),
            scope   : me
        },{
            xtype   : "button",
            text    : _("Policy"),
            icon    : "images/search.png",
            iconCls : Ext.baseCSSPrefix + "btn-icon-16x16",
            handler : Ext.Function.bind(me.onSearchButton, me, [ "policy" ]),
            scope   : me
        },{
            xtype   : "button",
            text    : _("dpkg -l"),
            icon    : "images/search.png",
            iconCls : Ext.baseCSSPrefix + "btn-icon-16x16",
            handler : Ext.Function.bind(me.onSearchButton, me, [ "dpkg" ]),
            scope   : me
        }]);
        return items;
    },

    onSearchButton : function (cmd) {
        this.type = cmd;
        var store = this.createStore();
        this.reconfigure(store, Ext.clone(this.columnsTpl));
        this.initState();
        this.getPagingToolbar().bindStore(this.store);
    }
});

OMV.WorkspaceManager.registerPanel({
    id        : "search",
    path      : "/service/apttool",
    text      : _("Search"),
    position  : 10,
    className : "OMV.module.admin.service.apttool.Search"
});
