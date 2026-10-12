<template>
	<div class="points-to-balance-container">
		<UserHeader title="积分转余额"></UserHeader>

		<div class="content">
			<!-- 账户信息 -->
			<div class="account-card">
				<div class="account-item">
					<span class="label">当前积分</span>
					<span class="value">{{ userInfo.n_points || 0 }}</span>
				</div>
				<div class="account-item">
					<span class="label">当前余额</span>
					<span class="value">￥{{ userInfo.n_balance || 0 }}</span>
				</div>
			</div>

			<!-- 兑换表单 -->
			<div class="convert-form">
				<div class="form-item">
					<BoxTitle>兑换比例</BoxTitle>
					<div class="ratio-tip">{{ ratio }} 积分 = 1 元</div>
				</div>

				<div class="form-item">
					<BoxTitle>兑换积分</BoxTitle>
					<div class="amount-input-wrapper">
						<a-input class="amount-input" type="digit" v-model="form.points" placeholder="请输入要兑换的积分" />
					</div>
					<div class="tips">
						<span class="tip-span">可兑换余额：￥{{ actualBalance }}</span>
					</div>
				</div>

				<div class="submit-section">
					<a-button class="submit-btn" type="primary" size="large" :loading="submitting" @click="handleSubmit">
						立即兑换
					</a-button>
				</div>
			</div>

			<!-- 规则 -->
			<div class="rules">
				<div class="rules-title">兑换规则</div>
				<div class="rules-content">
					<div class="rule-item">• {{ ratio }} 积分可兑换 1 元余额</div>
					<div class="rule-item">• 兑换后余额立即到账，不可撤销</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue';

const userInfo = ref({})
const form = ref({ points: '' })
const submitting = ref(false)

/* 兑换比例：多少积分兑 1 元 */
const ratio = computed(() => {
	return Number(userInfo.value.VipInfo?.n_points_ratio) || 100
})

const actualBalance = computed(() => {
	const points = parseFloat(form.value.points)
	if (!points || isNaN(points) || points <= 0) {
		return '0.00'
	}
	return (points / ratio.value).toFixed(2)
})

/* 获取我的信息 */
const getUserInfo = async () => {
	try {
		const res = await useApiFetch().post('/api/myinfo')
		if (res.code == 200) {
			userInfo.value = res.data
		} else {
			navigateTo('/login')
		}
	} catch (error) {
		Message.error('获取用户信息失败，请刷新页面重试')
	}
}
onMounted(getUserInfo)

/* 提交兑换 */
const handleSubmit = async () => {
	if (submitting.value) return

	const points = parseFloat(form.value.points)
	if (!points || isNaN(points) || points <= 0) {
		Message.error('请输入要兑换的积分')
		return
	}

	submitting.value = true
	try {
		const res = await useApiFetch().post('/api/pointsToBalance', { points })
		if (res.code === 200) {
			Message.success('兑换成功')
			form.value.points = ''
			getUserInfo()
			useUserInfo().init(() => { }, true)
		} else {
			Message.error(res.msg || '兑换失败')
		}
	} catch (error) {
		Message.error('兑换失败')
	} finally {
		submitting.value = false
	}
}
</script>

<style lang="scss" scoped>
.points-to-balance-container {}

.content {
	width: calc(100%);
	margin: 0 auto;
}

.account-card {
	background: rgba(255, 255, 255, 0.95);
	border-radius: 20px;
	padding: 20px 25px;
	margin-bottom: 10px;
	backdrop-filter: blur(10px);
	display: flex;
	justify-content: space-around;

	.account-item {
		display: flex;
		flex-direction: column;
		align-items: center;

		.label {
			color: #666;
			font-size: 13px;
		}

		.value {
			color: #00c451;
			font-size: 20px;
			font-weight: bold;
			margin-top: 6px;
		}
	}
}

.convert-form {
	background: rgba(255, 255, 255, 0.95);
	border-radius: 20px;
	padding: 25px;
	margin-bottom: 10px;
	backdrop-filter: blur(10px);
	width: calc(100% - 50px);

	.form-item {
		margin-bottom: 25px;

		&:last-child {
			margin-bottom: 0;
		}

		.ratio-tip {
			color: #00c451;
			font-size: 18px;
			font-weight: bold;
		}

		.amount-input-wrapper {
			display: flex;
			align-items: center;
			background: #f8f9fa;
			border-radius: 12px;
			padding: 15px;
			border: 2px solid transparent;
			transition: all 0.3s;
			width: calc(100% - 30px);

			.amount-input {
				flex: 1;
				font-size: 18px;
				font-weight: bold;
				color: #333;
				outline: none;
				background: transparent;
			}
		}

		.tips {
			margin-top: 8px;

			.tip-span {
				color: #999;
				font-size: 12px;
			}
		}
	}

	.submit-section {
		padding: 0 10px;

		.submit-btn {
			background-color: #00c451;
			width: 100%;
			border-radius: 20px;
		}
	}
}

.rules {
	background: rgba(255, 255, 255, 0.95);
	border-radius: 20px;
	padding: 25px;
	margin-bottom: 20px;
	backdrop-filter: blur(10px);

	.rules-title {
		color: #333;
		font-size: 16px;
		font-weight: bold;
		margin-bottom: 15px;
	}

	.rules-content {
		.rule-item {
			color: #666;
			font-size: 14px;
			line-height: 1.6;
			margin-bottom: 8px;
		}
	}
}
</style>
