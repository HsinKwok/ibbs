<template>
	<div>
		<!-- 账户余额 -->
		<UserHeader title="我的积分"></UserHeader>

		<div>
			<div class="AccountTab">
				<div class="Account">
					<div class="Item">
						<div class="title">积分</div>
						<div class="value">{{ UserInfo.$state.UserInfo.n_points }}</div>
					</div>
					<!-- 账单按钮 -->
					 <div class="bill-button" @click="navigateTo('/user/bill?type=1')">
                        查看账单
                    </div>

				</div>
				<!-- 操作栏 -->
				<div class="content">
					<div class="Item" @click="navigateTo('/user/pointsToBalance')">
						<div class="title">积分转余额</div>
					</div>
				</div>
			</div>
			<!-- 获取积分途径 -->
			<div class="get-points-way">
				<BoxTitle>获取积分途径</BoxTitle>
				<div class="Boxs">
					<div class="InfoItem" v-for="value in ActivityList" :key="value.id">
						<img class="InfoItemIcon" :src="value.n_icon" alt="" loading="lazy">
						<div class="InfoItemContent">
							<p class="InfoItemTitle">{{ value.n_name }}</p>
							<p class="InfoItemConte">{{ value.n_note }}</p>
						</div>


						<a-button class="ActiveBoxBut" type="primary" size="small" @click="navigateTo(safePath(value.n_path))">
							<template #icon>
								<icon-safe />
							</template>
							{{ value.n_buttext || '查看详情' }}
						</a-button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
const UserInfo = useUserInfo()

/* 本页属 /user 私有路由：await 布局已发起的 init()（同一 promise 自动去重），
   既保证首屏积分有值，又不再额外请求一次 /api/myinfo；取不到用户信息即视为登录态失效 */
await UserInfo.init()
if (!UserInfo.$state.UserInfo?.id) navigateTo('/login')

/* 获取活动列表 /api/getActivity：SSR 预取，客户端水合直接复用 */
const activity = await useApiSsr('user:activity', '/api/getActivity')
const ActivityList = ref(activity.code === 200 ? activity.data : [])

/* 活动跳转路径白名单：仅允许站内相对路径，避免 n_path 被配置为外部地址时跳离本站 */
const safePath = (target) => {
	if (typeof target !== 'string' || !target) return '/'
	if (!target.startsWith('/') || target.startsWith('//')) return '/'
	return target
}
</script>

<style lang="scss" scoped>
.AccountTab {
	width: calc(100%);
	border-radius: 20px;
	background-color: #fff;
	overflow: hidden;

	.Account {
		overflow: hidden;
		background-color: #077bff;
		background: linear-gradient(135deg, #00c451 0%, #00dd88 100%);
		display: flex;
		width: calc(100% - 40px);
		padding: 20px 20px;
		border-radius: 20px;
		position: relative;

		.icon {
			color: #ffffff48;
			position: absolute;
			right: 10px;
			top: -10px;
			width: 200px;
			height: 200px;
		}

		.bill-button {
			position: absolute;
			right: 20px;
			top: 20px;
			color: #fff;
			font-size: 12px;

		}

		.Item {
			width: calc(100% - 20px);
			padding: 10px;

			.title {
				font-size: 13px;
				color: #dfdfdf;
			}

			.value {
				font-size: 20px;
				color: #ffffff;
				font-weight: 700;
				margin-top: 3px;
			}
		}
	}

	.content {
		width: calc(100% - 30px);
		padding: 15px;
		background-color: #ffffff;
		display: flex;

		.Item {
			text-align: center;
			width: 100%;
			font-size: 14px;
			color: #333333;
			display: flex;
			justify-content: center;

			.icon {
				width: 20px;
				height: 20px;
				margin-right: 5px;
			}
		}
	}


}

.get-points-way {
	width: 100%;
	background-color: #fff;
	border-radius: 10px;
	margin: 10px auto;
	padding: 20px;

	.Boxs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-top: 10px;
	}

	.InfoItem {
		position: relative;
		// background-color: #f8f8f8;
		display: flex;
		align-items: center;
		padding: 10px;
		border-radius: 10px;
		margin-bottom: 4px;

		.InfoItemIcon {
			width: 40px;
			height: 40px;
			margin-right: 20px;
			margin-left: 0px;
		}

		.InfoItemContent {
			.InfoItemTitle {
				font-size: 14px;
				color: #000000;
				margin-bottom: 5px;
				font-weight: 800;
			}

			.InfoItemConte {
				font-size: 13px;
				color: #6d6d6d;
			}
		}

		.ActiveBoxBut {
			position: absolute;
			right: 4px;
			top: 16px;
			background-color: #ff5d2b;
			border-radius: 20px;
			font-size: 12px;
			color: #fff;
			padding: 2px 15px;
		}
	}
}
</style>