import React,{ Component } from "react";
import { connect  } from "react-redux";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  AsyncStorage,
  DeviceEventEmitter,
  Platform,
  RefreshControl,
  NetInfo,
  Vibration,
  ToastAndroid
} from 'react-native';
import moment from "moment";
import { ButtonGroup } from "react-native-elements";
import Beacons from "react-native-beacons-manager";
import { 
  TODAY, 
  UPCOMING, 
  TASK_NOT_START, 
  TASK_IN_PROGRESS, 
  TOKEN, 
  TIME_ATTENDANCE_AVAILABLE, 
  IOS, TASK_COMPLETED, 
  ABSENT, AUTHORIZATION, 
  CONTENT_TYPE, TASK_WAITING_FOR_APPROVE, 
  HOUR_FORMAT,
  BEACON_DID_RANGE,
  IBEACONS,
  ANDROID, 
} from "../../constants/common";
import { DEVICE_WIDTH, baseColor, DEVICE_HEIGHT } from "../../constants/mainSetting";
import { CHECK_ATTEND_SUCESSFUL,  ERR_SERVER_ERROR, CHECK_IN_SUCCESS } from "../../constants/alert";

import autobind from "class-autobind";
import { 
  requestTodayTaskURL, 
  requestUpcomingTask, 
  requestCheckAttendanceForTask 
} from "../../apis/taskAPI";
import axios from "axios";
import BackgroundTimer from "react-native-background-timer";
import TaskTodayView from "./taskToday";
import TaskUpcomingView from "./taskUpcoming";
import firebase from "react-native-firebase";

import { Navigation } from "react-native-navigation";

const YELLOW_ORANGE = "#ffa500"
      

class TaskEmployee extends Component {
 
  //contructors
  constructor(props) {
    super(props)
    this.state = {
      listTaskNotStart : [], 
      listTaskInProgress: [],
      listTaskCompleted: [],
      listTaskAbsent: [],
      listWaitCheckAttendance: [],
      listCheckedAttendance:[],
      listTaskPendingApproval: [],
      todayTasks: [],
      upcomingTasks: [],
      selectedIndex: 0,
      upcomingTaskDateView: [],
      refreshing: false,
      networkState: "none",
      upcomingTaskData : []
    }
    autobind(this)
  }

  componentDidUpdate(prevStates) {
    if (this.state.selectedIndex !== prevStates.selectedIndex) {
      switch(this.state.selectedIndex) {
        case 0: 
          //this._getTodayTask()
          break
        case 1:
          //this._getUpcomingTask()
          break
        default: 
          break
      }
    }
    // const localNoti = new firebase.notifications.Navigation()
    // .setTitle("abc")
    // .setBod
  }

  async componentDidMount() {
    this.navigationEventListener = Navigation.events().bindComponent(this);
    const token = await AsyncStorage.getItem(TOKEN) 
    this.setState({userToken: token})
    this._getTodayTask()
    this._getUpcomingTask()
    if(Platform.OS === IOS)  {
      BackgroundTimer.start()
    }
    // if(Platform.OS === ANDROID) {
    //   Beacons.detectIBeacons() 
    // }
    //Beacons.requestWhenInUseAuthorization();
    //await Beacons.startMonitoringForRegion();
    // Beacons.startRangingBeaconsInRegion({identifier: 'iBeacons',
    // uuid: 'fda50693-a4e2-4fb1-afcf-c6eb07647825'})
    
    // //   console.log(`Beacons ranging started succesfully!`)
    // Beacons.startRangingBeaconsInRegion({identifier: IBEACONS, 
    //   uuid: 'fda50693-a4e2-4fb1-afcf-c6eb07647825'})
    //   DeviceEventEmitter.addListener('beaconsDidRange', data => {
    //     // list
    //     const beaconLists = data.beacons
    //     console.log("Beacon list: ", beaconLists)
    //   })
    //   setTimeout(async() => {
    //     await Beacons.stopRangingBeaconsInRegion({identifier: IBEACONS}) 
    //   }, 5000)
    // if (Platform.OS === IOS) {
    //   Beacons.startUpdatingLocation();
    // }
    //await Beacons.stopRangingBeaconsInRegion({identifier: IBEACONS})
    BackgroundTimer.runBackgroundTimer(() => { 
      console.log('list task not start: ', this.state.listTaskNotStart)
      if(typeof(this.state.listTaskNotStart !== undefined) &&
        this.state.listTaskNotStart.length !== 0) {
        this.state.listTaskNotStart.forEach((task) => {
          if (this._checkConditionForCheckAttendance(task)
              && !this.state.listWaitCheckAttendance.includes(task)){
              this.state.listWaitCheckAttendance.push(task)
          }
        }) 
         console.log('list wait',this.state.listWaitCheckAttendance)
          this._checkGateStatus()
        }
    }, 
      10000
      //  60000 // = 1 mins
    ); 
    firebase.notifications().onNotification((notification) => {
       this._getTodayTask()
    })
  } 

  async componentWillMount() {
    axios.defaults.headers.common[CONTENT_TYPE] = "application/json"
    axios.defaults.headers.common[AUTHORIZATION] =await AsyncStorage.getItem(TOKEN)
    NetInfo.isConnected.addEventListener('connectionChange', (connectionType) => {
       if (!connectionType) {
         this.setState({
           networkState: "flex"
         }) 
       } else {
         this.setState({
           networkState: "none"
         })
       }
    })
  }

  _getTodayTask() {
    axios.get(requestTodayTaskURL(this.props.userId), { }).then(res => {
      console.log('res: ', res.data)
      this.setState({
        listWaitCheckAttendance :[],
        listTaskNotStart: this._loadListTaskByStatus(TASK_NOT_START, res.data),
        listTaskInProgress: this._loadListTaskByStatus(TASK_IN_PROGRESS, res.data),
        listTaskCompleted: this._loadListTaskByStatus(TASK_COMPLETED, res.data),
        listTaskPendingApproval: this._loadListTaskByStatus(TASK_WAITING_FOR_APPROVE, res.data),
        listTaskAbsent: res.data.filter(t => t.attendanceStatus === ABSENT)
      })
    }).catch(err => {
      ToastAndroid.showWithGravity(ERR_SERVER_ERROR,ToastAndroid.SHORT,ToastAndroid.BOTTOM)
    })
  }

  _setUpcomingTaskDateView() {
    if (this.state.upcomingTasks.length !== 0) {
      let upcomingTask = new Array(this.state.upcomingTasks.length).fill("white")
      upcomingTask.splice(0,1,baseColor)
      this.setState({
        upcomingTaskDateView: upcomingTask
      })
    } else { 
      this.setState({
        upcomingTaskDateView: []
      })
    }
  }

  _returnEachDataForTimeLine(task) {
    return {
      time: moment(task.startTime).format(HOUR_FORMAT) + "\n" + moment(task.endTime).format(HOUR_FORMAT), 
      title: task.title, 
      id: task.id,
      description: "Mô tả: " + task.description + "\n" + "Tại công ty: " + task.companyDTO.name,
      circleColor: '#009688',
      lineColor:'#009688',
    }
  } 

  _getUpcomingTask() {
    axios.get(requestUpcomingTask(this.props.userId),{}
    ).then(res => {
      this.setState({
        upcomingTasks: res.data
      }) 
     }).catch(err => {
        switch(err.response.status) {
          case 500: 
          case 502: 
           ToastAndroid.showWithGravity(
             ERR_SERVER_ERROR,ToastAndroid.SHORT,ToastAndroid.BOTTOM)
           break;
        }
     })
    
     this.state.upcomingTaskData = []
     if (this.state.upcomingTasks.length !== 0) {
        this.state.upcomingTasks[0].list.forEach((task) => {
         let data = this._returnEachDataForTimeLine(task) 
         this.state.upcomingTaskData.push(data)
       }) 
      this.setState({
        upcomingTaskData: this.state.upcomingTaskData
      })
      this._setUpcomingTaskDateView()
     } else {
       this.setState({
        upcomingTaskData: []
       })
     }
  }

  _loadListTaskByStatus = (statusId, listTotalTask) => {
    return listTotalTask.filter(t => t.status === statusId && t.attendanceStatus !== ABSENT)
  }

  _checkConditionForCheckAttendance = (task) => {
    const tComparedStart = this._compareTimeToCurrent(task.startTime)
    const tComparedEnd = this._compareTimeToCurrent(task.endTime)

      if (tComparedStart <= TIME_ATTENDANCE_AVAILABLE) {
        //console.log('tcompared start ', tComparedStart + ' start time task ',task.startTime)
        //console.log('tcompared end ', tComparedEnd + ' start time task ',task.startTime)
        if(tComparedEnd <= TIME_ATTENDANCE_AVAILABLE){
            //check absent for task 
          axios.put(requestCheckAttendanceForTask(task.id), {},{
          }).then(t =>{
            this.state.listCheckedAttendance.push(task)
            this._removeTaskCheckedAttendance()
          }) 
          return false;
        }else{
          return true
        }
      }
      else {  
        return false
      }
  }
  
  _updateIndex(selectedIndex) {
    switch(selectedIndex) {
      case 0: 
        this._getTodayTask()
        break;
      case 1:
        this._getUpcomingTask()
        this._setUpcomingTaskDateView()
        break;
    }
    this.setState({
      selectedIndex: selectedIndex,
    })  
  }

  _compareTimeToCurrent(time) { 
    var current = moment(new Date()),
        timeM = moment(time),
        differenceInMs = timeM.diff(current ,"minutes")
        //console.log('current time: ', current.toString())
        //console.log('moment time: ', timeM.toString())
        //console.log('different in ms: ', differenceInMs)
    return differenceInMs
  }

  async _removeTaskCheckedAttendance(){
   //console.log('remove: list checked before remove',this.state.listCheckedAttendance)
     this.state.listTaskNotStart.forEach((task,index,arrayNotStart) => {
        if (this.state.listCheckedAttendance.includes(task)) {
          arrayNotStart.splice(index,1)
        }
     });
    
     this.state.listCheckedAttendance = []

     if(this.state.listTaskNotStart.length === 0){
      await Beacons.stopRangingBeaconsInRegion({identifier: IBEACONS}) 
      //console.log('da dong gate do list not start empty')
    }
    //console.log('remove : list not start after removed',this.state.listTaskNotStart)
  }

  _checkGateStatus = async () => {
  if(this.state.listWaitCheckAttendance.length > 0) {
    Beacons.detectIBeacons()
    try {
      //console.log('Enter beacon check !')
      const initialRegion = {
        identifier: IBEACONS,
        uuid: this.state.listWaitCheckAttendance[0].beaconModel.uuid
      }
      await Beacons.startRangingBeaconsInRegion(initialRegion)//IBEACONS)
      //console.log(`Beacons ranging started succesfully!`)
      DeviceEventEmitter.addListener(BEACON_DID_RANGE, data => {
        //console.log('beacon found: ', data)
        // list
        const beaconLists = data.beacons
        //console.log("Beacon list: ", beaconLists)
        beaconLists.forEach(beacon => {
          this.state.listWaitCheckAttendance.forEach((task,index,arrayWait) => {
            //console.log('beacon_found :' , beacon.uuid + ' beacon_task',task.beaconModel)
            if (beacon.uuid === task.beaconModel.uuid &&
                beacon.major === task.beaconModel.major &&
                beacon.minor === task.beaconModel.minor){
                  //console.log('tim thay beacon trung')
              axios.put(requestCheckAttendanceForTask(task.id), {},{
              }).then(t => {
                let localNoti = new firebase.notifications.Notification()
                      .setNotificationId('CheckInBeaconId')
                      .setTitle(CHECK_IN_SUCCESS)
                      .setBody(CHECK_ATTEND_SUCESSFUL)
                      .android.setChannelId("channelOEM")
                      .android.setSmallIcon("ic_launcher")
                    let date = new Date();
                    date.setSeconds(date.getSeconds() + 2);
                    //console.log('date after set mins : ', date)
                    //console.log('local noti: ', localNoti)
                    firebase.notifications().scheduleNotification(localNoti, {
                      fireDate: date.getTime(),
                    })
                  this._getTodayTask()
                  Vibration.vibrate(700)
                  Alert.alert(NOTIFICATION, CHECK_ATTEND_SUCESSFUL)
              })
              this.state.listCheckedAttendance.push(task)
              arrayWait.splice(index,1)
            }
          })
        })
        if(this.state.listCheckedAttendance.length >0 ){
          this._removeTaskCheckedAttendance()
        }
      })
      //DeviceEventEmitter.removeAllListeners
     // console.log('done start gate')
    }catch (err) {
      console.log(`Beacons ranging not started, error: ${error}`)
      console.log('da dong gate list wait empty')
    }
  } else { 
    //await DeviceEventEmitter.emit('beaconsDidRange')
    //DeviceEventEmitter.removeListener('beaconsDidRange')
    console.log('gate closed')
    await Beacons.stopRangingBeaconsInRegion({identifier: IBEACONS})
  }}

  _renderTodayTask() {
    return(
       <TaskTodayView 
        listTaskInProgress={this.state.listTaskInProgress}
        listTaskPendingApproval={this.state.listTaskPendingApproval}
        listTaskNotStart={this.state.listTaskNotStart}
        listTaskCompleted={this.state.listTaskCompleted}
        listTaskAbsent={this.state.listTaskAbsent}/>
    )
  }

  _renderUpcomingTask() {
     return(
       <TaskUpcomingView 
        upcomingTasks={this.state.upcomingTasks} 
        upcomingTaskData={this.state.upcomingTaskData}
        upcomingTaskDateView={this.state.upcomingTaskDateView}
       />
     )
  }
  
  _onRefresh = () => {
    this.setState({refreshing: true});
    if (this.state.selectedIndex === 0) {
      this._getTodayTask()
    } else {
      this._getUpcomingTask() 
    }
    this.setState({
      refreshing: false
    })
  }
  
  //render view 
  render() {
    const buttons = [TODAY, UPCOMING] 
    return (
      <View style={{
        height: (this.state.selectedIndex === 0) ? DEVICE_HEIGHT - 100 : DEVICE_HEIGHT
      }}>
          <ButtonGroup 
            onPress={index => { this._updateIndex(index) }}
            selectedIndex={this.state.selectedIndex}
            buttons={buttons}
            textStyle={styles.textStyleButtonGroup}
            buttonStyle={styles.buttonStyle}
            containerStyle={styles.containerStyleButtonGroup}
            innerBorderStyle={{ color: "#ffffff" }}
            selectedButtonStyle={styles.selectedButtonStyleGroup}
            selectedTextStyle={styles.selectedTextStyle}
            fontFamily="Roboto-Bold"
          />
         <Text style={[styles.noIntenetConnection,{
            display: this.state.networkState
         }]}>Không có kết nối</Text>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={this.state.refreshing}
              onRefresh={this._onRefresh}
            />
          } 
          alwaysBounceVertical={true}
          contentContainerStyle={styles.scrollViewContainer}>
            {
             (this.state.selectedIndex === 0) ? 
              this._renderTodayTask() 
               : 
              this._renderUpcomingTask()
            }
        </ScrollView>
     </View> 
    )
  }
}

const styles = StyleSheet.create({
  noIntenetConnection: {
    width: DEVICE_WIDTH,
    backgroundColor: YELLOW_ORANGE,
    justifyContent: "center",
    alignItems: "center",
    color: "white"
  },
  textStyleButtonGroup: {
    color: baseColor,
    fontFamily: 'Roboto-Bold',
    fontSize: 18
  },
  buttonStyle: {
    borderColor: baseColor,
    borderWidth: 1,
    borderRadius: 20,
    marginLeft: 3,
    marginRight: 3,
  },
  containerStyleButtonGroup: {
    backgroundColor: 'white',
    borderWidth: 0,
    height: 40
  },
  selectedButtonStyleGroup: {
    backgroundColor:  "#2a89fc",
    borderRadius: 20,
    borderColor: "#ffffff",
  },
  selectedTextStyle: {
    color: 'white',
    fontFamily: 'Roboto-Bold',
    fontSize: 18
  },
  scrollViewContainer: {
    flexGrow: 0.9, 
    width: DEVICE_WIDTH
  }, 
})

export default connect(
  null, 
  null
)(TaskEmployee)
