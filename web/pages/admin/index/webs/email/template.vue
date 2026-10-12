<template>
    <div>
        <div class="Page">


            <div class="Pagecontent">
                <a-space style="margin-bottom: 10px;">
                    <a-input v-model="query.search" placeholder="模糊搜索" allow-clear />
                    <a-button type="primary" @click="load()">检索</a-button>
                    <a-button type="primary" @click="openAdd()">新增模板</a-button>
                    <a-button type="primary" status="danger" :disabled="!selectedKeys.length" :loading="batchDeleting" @click="batchDelete()">批量删除</a-button>
                </a-space>
                <a-table :columns="columns" :data="list" :pagination="false" :loading="loading" row-key="id"
                    v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :scroll="{
                    y: 'calc(100vh - 190px)',
                    x: '100%'
                }">
                    <template #n_image="{ record }">
                        <a-avatar :size="24">
                            <img alt="avatar" :src="record.n_image" loading="lazy" />
                        </a-avatar>
                    </template>

                    <template #console="{ record }">
                        <a-space>
                            <a-button size="mini" @click="openEdit(record)"
                                type="primary">编辑</a-button>
                            <a-popconfirm content="确认要删除此数据？删除后将无法恢复" type="error" @ok="() => { del(record.id) }"
                                position="bottom">
                                <a-button size="mini" type="primary" status="danger">删除</a-button>
                            </a-popconfirm>
                        </a-space>
                    </template>
                    <template #footer>
                        <ListPager v-model:current="query.page" v-model:pageSize="query.pagesize" :total="query.total"
                            show-page-size :page-size-options="[50, 100, 200, 500, 1000]" @load="load" />
                    </template>
                </a-table>
            </div>
        </div>

        <a-drawer :width="940" :visible="visible" @ok="submit" @cancel="() => {
            visible = false
        }" unmountOnClose title="模板信息管理">
            <div>
                <a-form style="margin: 0 auto;" :model="info">
                    <a-form-item field="name" label="名称">
                        <a-input v-model="info.n_name" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="编码">
                        <a-input v-model="info.n_code" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="备注">
                        <a-input v-model="info.n_remarks" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="HTML模板内容">
                        <MonacoEditor 
                            v-model="info.n_html" 
                            language="html"
                            height="500px"
                            theme="vs"
                            :options="{
                                wordWrap: 'on',
                                minimap: { enabled: false },
                                formatOnPaste: true,
                                formatOnType: true,
                                suggestOnTriggerCharacters: true,
                                acceptSuggestionOnEnter: 'on',
                                tabCompletion: 'on',
                                bracketPairColorization: { enabled: true }
                            }"
                        />
                    </a-form-item>
                    <a-form-item field="post" label="模板预览">
                        <div v-html="safePreview" style="width: 100%;">

                        </div>
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>

    </div>
</template>

<script setup>
import { computed } from 'vue'
import { sanitizeHtml } from '@/utils/sanitize'
/* 统一列表页封装：查询 + 分页 + 删除 + 批量删除 + 新增/编辑抽屉 */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openAdd, openEdit, submit } = useAdminTable({
    api: '/api/getEmailTemplate',
    remove: '/api/delEmailTemplate',
    batchRemove: '/api/batchDelEmailTemplate',
    addApi: '/api/addEmailTemplate',
    editApi: '/api/editEmailTemplate',
    label: '邮件模板',
})

/* 模板预览走统一清洗，避免后台模板内的脚本在管理端被执行 */
const safePreview = computed(() => sanitizeHtml(info.value?.n_html || ''))

const columns = [
    {
        title: '名称',
        dataIndex: 'n_name',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '编码',
        dataIndex: 'n_code',
    },
    {
        title: '创建时间',
        dataIndex: 'n_time',
    },
    {
        title: '模板备注',
        dataIndex: 'n_remarks',
    },
    {
        title: '操作',
        dataIndex: 'console',
        slotName: 'console',
        width: 220,
        fixed: 'right',
    },
];

useSeoSet({
    title: '邮箱模板信息管理'
})
</script>

<style lang="scss" scoped>
.Page {
    background-color: #fff;
    margin: 1px;
    width: calc(100% - 2px);

    .Pagecontent {
        width: calc(100% - 20px);
        padding: 10px;
        margin-top: -30px;
    }

}
</style>
