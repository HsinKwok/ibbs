<template>
    <div>
        <div class="Page">
            <a-page-header title="导航维护管理" :show-back="false">
                <template #subtitle>
                </template>
            </a-page-header>
            <div class="Pagecontent">
                <div>

                    <a-space style="margin-bottom: 10px;">
                        <a-input v-model="query.search" placeholder="模糊搜索" allow-clear />
                        <a-button type="primary" @click="load()">检索</a-button>
                        <a-button type="primary" @click="openAdd({ n_fid: 0 })">新增导航</a-button>
                        <a-button type="primary" status="danger" :disabled="!selectedKeys.length"
                            :loading="batchDeleting" @click="batchDelete()">批量删除</a-button>
                    </a-space>

                    <a-table :columns="columns" :data="list" :pagination="false" :loading="loading"
                        row-key="id" v-model:selectedKeys="selectedKeys" :row-selection="rowSelection"
                        @row-click="changeNav" :draggable="{ type: 'handle', width: 40 }" @change="handleNavListChange"
                        :scroll="{
                            y: 'calc(100vh - 190px)',
                            x: '100%'
                        }">
                        <template #n_icon="{ record }">
                            <a-avatar :size="24">
                                <img alt="avatar" :src="record.n_icon" loading="lazy" />
                            </a-avatar>
                        </template>
                        <template #console="{ record }">
                            <a-space @click.stop>
                                <a-button size="mini" @click="openEdit(record)"
                                    type="primary">编辑</a-button>
                                <a-popconfirm content="确认要删除此数据？删除后将无法恢复" type="error"
                                    @ok="() => { del(record.id) }" position="bottom">
                                    <a-button size="mini" type="primary" status="danger">删除</a-button>

                                </a-popconfirm>
                            </a-space>
                        </template>
                        <template #footer>
                            <ListPager v-model:current="query.page" v-model:pageSize="query.pagesize"
                                :total="query.total" show-page-size :page-size-options="[50, 100, 200, 500, 1000]"
                                @load="load" />
                        </template>
                    </a-table>
                </div>

                <div>
                    <a-space style="margin-bottom: 10px;">
                        <a-input v-model="sub.query.value.search" placeholder="模糊搜索" allow-clear />
                        <a-button type="primary" @click="sub.load()">检索</a-button>
                        <a-button type="primary"
                            @click="openAdd({ n_fid: sub.query.value.fid })">新增导航</a-button>
                        <a-button type="primary" status="danger" :disabled="!sub.selectedKeys.value.length"
                            :loading="sub.batchDeleting.value" @click="sub.batchDelete()">批量删除</a-button>
                    </a-space>

                    <a-table :columns="columns" :data="sub.list.value" :pagination="false" :loading="sub.loading.value"
                        row-key="id" v-model:selectedKeys="sub.selectedKeys.value" :row-selection="sub.rowSelection"
                        @change="handleSecondNavChange" :draggable="{ type: 'handle', width: 40 }" :scroll="{
                            y: 'calc(100vh - 190px)',
                            x: '100%'
                        }">
                        <template #n_icon="{ record }">
                            <a-avatar :size="24">
                                <img alt="avatar" :src="record.n_icon" loading="lazy" />
                            </a-avatar>
                        </template>
                        <template #console="{ record }">
                            <a-space>
                                <a-button size="mini" @click="openEdit(record)"
                                    type="primary">编辑</a-button>
                                <a-popconfirm content="确认要删除此数据？删除后将无法恢复" type="error"
                                    @ok="() => { sub.del(record.id) }" position="bottom">
                                    <a-button size="mini" type="primary" status="danger">删除</a-button>

                                </a-popconfirm>
                            </a-space>
                        </template>
                        <template #footer>
                            <ListPager v-model:current="sub.query.value.page" v-model:pageSize="sub.query.value.pagesize"
                                :total="sub.query.value.total" show-page-size :page-size-options="[50, 100, 200, 500, 1000]"
                                @load="sub.load" />
                        </template>
                    </a-table>
                </div>
            </div>
        </div>

        <a-drawer :width="540" :visible="visible" @ok="submit" @cancel="() => {
            visible = false
        }" unmountOnClose title="导航信息设置">
            <div>
                <a-form style="margin: 0 auto;" :model="info">
                    <a-form-item field="name" label="图标">
                        <Upimg :src="info.n_icon" width="100" height="100" @success="(e) => {
                            info.n_icon = e
                        }"></Upimg>
                    </a-form-item>
                    <a-form-item field="name" label="名称">
                        <a-input v-model="info.n_name" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="类型">
                        <a-select v-model="info.n_type" placeholder="请选择">
                            <a-option value="1">内部页面</a-option>
                            <a-option value="2">外部页面</a-option>
                        </a-select>
                    </a-form-item>
                    <a-form-item field="post" label="路径">
                        <a-input v-model="info.n_path" placeholder="请输入" />
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>

    </div>
</template>

<script setup>
/* 统一列表页封装：主子导航双列表联动 */
const {
    list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete,
    sub,
    visible, info, openAdd, openEdit, submit,
} = useAdminTable({
    api: '/api/getNavList',
    extraQuery: { fid: 0 },
    remove: '/api/delNavigation',
    batchRemove: '/api/batchDelNavigation',
    addApi: '/api/addNavigation',
    editApi: '/api/editNavigation',
    label: '导航',
    sub: {
        api: '/api/getNavList',
        extraQuery: { fid: 0 },
        remove: '/api/delNavigation',
        batchRemove: '/api/batchDelNavigation',
    },
    beforeSubmit: (info) => { delete info.n_fid_list },
    onMainLoaded: (data, subTable) => {
        if (data && data.length > 0) {
            /* 仅在当前选中的父级已不存在时才回退到第一项，避免保存后选中项被重置 */
            const current = subTable.query.value.fid
            if (!data.some((d) => d.id === current)) {
                subTable.query.value.fid = data[0].id
                subTable.load()
            }
        } else {
            subTable.query.value.fid = 0
            subTable.list.value = []
        }
    },
})

/* 主表拖拽排序 */
const handleNavListChange = useDragSort({ list, api: '/api/editNavigation', field: 'n_index', reload: load })

/* 子表拖拽排序 */
const handleSecondNavChange = useDragSort({ list: sub.list, api: '/api/editNavigation', field: 'n_index', reload: () => sub.load() })

/* 切换：点击主表行，联动加载子表 */
const changeNav = (info) => {
    sub.query.value.fid = info.id
    sub.load()
}

const columns = [
    {
        title: '图标',
        slotName: 'n_icon',
        width: 60,
    },
    {
        title: '名称',
        dataIndex: 'n_name',
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '类型',
        dataIndex: 'n_type',
        width: 150,
    },
    {
        title: '路径',
        dataIndex: 'n_path',
        width: 150,
    },
    {
        title: '操作',
        dataIndex: 'console',
        slotName: 'console',
        width: 150,
        fixed: 'right',
    },
];
</script>

<style lang="scss" scoped>
.Page {
    background-color: #fff;
    margin: 1px;
    width: calc(100% - 2px);

    .Pagecontent {
        width: calc(100% - 20px);
        padding: 10px;
        display: flex;
        gap: 10px;
    }

}
</style>
