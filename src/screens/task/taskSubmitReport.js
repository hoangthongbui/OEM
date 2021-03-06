import React,{ Component } from "react";
import { 
  View, 
  Text,
  TouchableOpacity,
  PermissionsAndroid,
  ScrollView,
  TextInput,
  Alert,
  AsyncStorage,
  StyleSheet,
 } from "react-native";
import { CheckBox } from "react-native-elements";
import Icon from "react-native-vector-icons/FontAwesome"
import { connect } from "react-redux";
import { Navigation } from "react-native-navigation";
import { uploadImageAPI } from "../../api-service/uploadImageAPI";
import { submitReportAPI } from "../../api-service/reportAPI";
import autobind from "class-autobind";
import ImageInstance from "../../elements/imageInstance";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5"
import axios from "axios";
import { 
  CAMERA_SCREEN, 
  TASK_SCREEN, 
  LOADING_SCREEN,
  MAP_SCREEN,
  NOTIFICATION_SCREEN,
  COMPANY_INFO_SCREEN,
} from "../../constants/screen";
import { DEVICE_HEIGHT, DEVICE_WIDTH } from "../../constants/mainSetting";
import * as commons from "../../constants/common"; 
import * as alerts from "../../constants/alert";
import Voice from "react-native-voice";
const GREEN = "#00a86a"


class TaskSubmitReport extends Component {
 
  constructor(props) {
    super(props)
     this.state={
       taskId: "",
       imgUris: [], 
       audioUris:"",
       description: "",
       reportType: "",
       taskCheckList: [],
       partialWord: "",
       reportFunctionsView: "flex",
       recordStatus: false,
       listSuggestDescriptionCheck: [true, false, false]
     }
     Voice.onSpeechStart = this.onSpeechStart;
     Voice.onSpeechRecognized = this.onSpeechRecognized;
     Voice.onSpeechEnd = this.onSpeechEnd;
     Voice.onSpeechError = this.onSpeechError;
     Voice.onSpeechResults = this.onSpeechResults;
     Voice.onSpeechPartialResults = this.onSpeechPartialResults;
     Voice.onSpeechVolumeChanged = this.onSpeechVolumeChanged;
    autobind(this) 
  }
 
  onSpeechStart = e => {
    // eslint-disable-next-line
    console.log('onSpeechStart: ', e);
  };

  onSpeechRecognized = e => {
    // eslint-disable-next-line
    console.log('onSpeechRecognized: ', e);
  }

  onSpeechEnd = async (e) => {
    // eslint-disable-next-line
    console.log('onSpeechEnd: ', e);
    // this.setState({
    //   recordStatus: false
    // })
    //await Voice.stop()
    //await Voice.destroy()
  }

  onSpeechError = e => {
    // eslint-disable-next-line
    console.log('onSpeechError: ', e.error);
  }

  onSpeechPartialResults = e => {
    // eslint-disable-next-line
    if (e.value[0] !== "") {
      let t = Array.from(e.value[0].split(" "))
      console.log("t: ",t)
      let newPartial = t[t.length - 1]
      console.log("new partial: ", newPartial)
      if (this.state.partialWord !== newPartial)
      this.setState({ 
        description: this.state.description + " " + newPartial,
        partialWord: newPartial
      })
    }
    
  }

  onSpeechResults = e => {
    console.log('onSpeechResult: ', e.value)
  }

  componentDidUpdate(prevProps) { //update 
    if (this.props.imageUriReport !== prevProps.imageUriReport) {
      this.state.imgUris.push(this.props.imageUriReport)
      this.setState({
        imgUris: this.state.imgUris
      })
    }
  }

  async componentWillUnmount() {
    if(this.state.imgUris.length !== 0 && 
       this.state.description.length !== 0)
    await AsyncStorage.setItem(commons.TASK_IN_PROGRESS_TEMP_ID, this.state.taskId.toString())
    switch(this.state.reportType) {
      case commons.REPORT_TASK:
        await AsyncStorage.setItem(commons.TASK_REPORT_WORK_TEMP, this.state.imgUris.toString())
        await AsyncStorage.setItem(commons.TASK_REPORT_WORK_DESCRIPTION_TEMP, this.state.description.toString())
        break 
      case commons.REPORT_PROBLEM:
        await AsyncStorage.setItem(commons.TASK_REPORT_PROBLEM_TEMP, this.state.imgUris.toString())
        await AsyncStorage.setItem(commons.TASK_REPORT_PROBLEM_DESCRIPTION_TEMP, this.state.description.toString())
        break
    }
  }

  async componentWillMount() {
    axios.defaults.headers.common[commons.AUTHORIZATION] =await AsyncStorage.getItem(commons.TOKEN)
    const {reportType, taskId, taskStatus, taskCheckList} = this.props
    //console.log("props: ", this.props)
    const tempWorkReport = await Promise.all([
      AsyncStorage.getItem(commons.TASK_IN_PROGRESS_TEMP_ID),
      AsyncStorage.getItem(commons.TASK_REPORT_WORK_TEMP),
      AsyncStorage.getItem(commons.TASK_REPORT_WORK_DESCRIPTION_TEMP)
    ])
    const tempProblemReport = await Promise.all([
      AsyncStorage.getItem(commons.TASK_IN_PROGRESS_TEMP_ID),
      AsyncStorage.getItem(commons.TASK_REPORT_PROBLEM_TEMP),
      AsyncStorage.getItem(commons.TASK_REPORT_PROBLEM_DESCRIPTION_TEMP)
    ])
    switch (reportType) {
      case commons.REPORT_TASK: 
        if (tempWorkReport[0] == this.props.taskId) {
          this.setState({
            imgUris: tempWorkReport[1].split(","),
            description: tempWorkReport[2]
          })
        }
        break
      case commons.REPORT_PROBLEM:
        if (tempProblemReport[0] == this.props.taskId) {
          this.setState({
            imgUris: tempProblemReport[1].split(","),
            description: tempProblemReport[2]
          })
        }
        break
    }
    this.setState({ 
      reportType: reportType, 
      taskId: taskId,
      taskStatus: taskStatus,
      taskCheckList: taskCheckList
    })
  }

  _createFormData(uri) { 
      const formData = new FormData();
      formData.append('dataFile', {
        uri: uri,
        type: 'image/jpeg',
        name: 'report' + ".jpg"
      })
      return formData
  }

  async _submitReport() {
    Navigation.showModal({
      component: {
        name: LOADING_SCREEN.settingName,
      }, 
    })
    const userId = await AsyncStorage.getItem(commons.USER.ID)
    const imageUrls = await Promise.all(
      this.state.imgUris.map(async (uri) => {
      const link = uploadImageAPI(), 
            formData = this._createFormData(uri)
      const response = await axios({
        url: link,
        method: "POST",
        data: formData,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'multipart/form-data',
        }
      });
      //console.log("response data: ", response.data)
      return response.data; 
    }));
    const photoString = imageUrls.join("; ")
    const submitLink = submitReportAPI();
    axios({
       url: submitLink,
       method: "POST",
       data: {
        "checkList": (this.state.reportType === 1) ? this.state.taskCheckList : [],
        "dto": {
          "description": this.state.description,
          "employeeId": userId,
          "photo": photoString,
          "taskId": this.state.taskId,
          "type": this.state.reportType
        }
      },
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }
    }).then(async (res) => {
        Navigation.dismissAllModals()
        switch(this.state.reportType) {
          case commons.REPORT_TASK: 
            await AsyncStorage.multiRemove([
              commons.TASK_REPORT_WORK_DESCRIPTION_TEMP,
              commons.TASK_REPORT_WORK_TEMP
            ])
            break;
          case commons.REPORT_PROBLEM: 
            await AsyncStorage.multiRemove([
              commons.TASK_REPORT_PROBLEM_DESCRIPTION_TEMP,
              commons.TASK_REPORT_PROBLEM_TEMP
            ])
            break;
        }
        Alert.alert(alerts.NOTIFICATION, alerts.UPDATE_TASK_SUCCESS,[],{
          onDismiss: () => this._handlePop()
        })
    }).catch(err => {
        Navigation.dismissAllModals()
        Alert.alert(alerts.NOTIFICATION, alerts.UPDATE_TASK_FAILED)
    })
  }

  _handlePressCamera() { 
      if (this.state.imgUris.length === 6) {
        Alert.alert(alerts.NOTIFICATION, alerts.MAX_FILE_LIMIT)
        return;
      }
      Navigation.showModal({
      component: {
        name: CAMERA_SCREEN.settingName,
        passProps: {
          action: "report"
        }
      }
  })}

  _handlePop() {
     switch(this.props.navigateFrom) {
      case TASK_SCREEN.id:
        Navigation.popToRoot(TASK_SCREEN.id,{})
        break;
      case COMPANY_INFO_SCREEN.id:
        Navigation.popToRoot(MAP_SCREEN.id,{})
        break;
      case NOTIFICATION_SCREEN.id: 
        Navigation.popToRoot(NOTIFICATION_SCREEN.id,{})
        break
      //case commons.TASK_NOTIFICATION: 
      //  Navigation.dismissAllModals()
      //  break
    }
  }

  async _activateAudioRecord(){
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Cho phép ứng dụng ghi âm',
          message: 'Để nhận diện giọng nói, bạn phải cho phép ứng dụng ghi âm',
          buttonPositive: "Tiếp tục"
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        if (!this.state.recordStatus) {
          console.log("start recording...")
          try {
            Voice.start('vi-VN')
            this.setState({
              recordStatus: true
            })
            //ToastAndroid.show("")
          } catch (err) {
            console.log("err at record start: ", err)
          }
       } 
       else {
        console.log("stop recording...")
        this.setState({
          recordStatus: false  
        }) 
        setTimeout(async () => await Voice.stop(),200)
        //await Voice.destroy()
       }
      } else {
        Alert.alert(alerts.ERR, "Bạn phải cho phép ứng dụng truy cập micro trước !")
      }
    } catch (err) {
      console.warn(err);
    }
  }

  _handleSubmitReport() {
    if (this.state.imgUris.length === 0) {
      Alert.alert(alerts.NOTIFICATION, alerts.MIN_FILE_LIMIT)
      return;
    }
    else {
      switch (this.state.reportType) {
        case 1: 
        Alert.alert(alerts.CONFIRM_SUBMIT_MESSAGE, alerts.CONFIRM_SUBMIT_REPORT, [
          {
            text: commons.YES,
            onPress: this._submitReport
          }, 
          {
            text: commons.NO,
            onPress: () => console.log('User Denied')
          }
        ])
        break
        case 2:
        Alert.alert(alerts.CONFIRM, alerts.CONFIRM_SUBMIT_PROBLEM, [
          {
            text: commons.YES,
            onPress: this._submitReport
          }, 
          {
            text: commons.NO,
            onPress: () => console.log('User Denied')
          }
        ])
        break
        default: 
          console.log("nothing !")
          break
      }
    }
   }
  
  render() {
    return( 
      <View style={styles.container}>
        <View style={{flexDirection: "row", alignItems: "center", justifyContent: "space-around"}}>
          <TextInput style={styles.textDescription}
            onChangeText={(text) => {
              this.setState({
                description: text
              })
            }}
            value={this.state.description}
            placeholder={commons.PLACEHOLDER_DESCRIPTION}
            multiline={true}
            allowFontScaling={false}
          />
          <TouchableOpacity onPress={this._activateAudioRecord}>
            {
              (this.state.recordStatus) ? 
              <FontAwesome5 name="microphone" color={GREEN} size={30}/> :
              <FontAwesome5 name="microphone" color={commons.GREY} size={30}/> 
            }
          </TouchableOpacity>
        </View>
        <View> 
          {
            (this.state.reportType === 1 ? 
            commons.listSuggestDescriptions : 
            commons.listSuggestDescriptionsProblem).map((t,i) => {
              return (
                <CheckBox containerStyle={styles.checkBoxContainer} 
                  title={t}
                  onPress={() => {
                    this.state.listSuggestDescriptionCheck.fill(false)
                    this.state.listSuggestDescriptionCheck[i] = true
                    if (t == commons.listSuggestDescriptions[1]) {
                      this.setState({
                        description: "",
                        listSuggestDescriptionCheck: this.state.listSuggestDescriptionCheck
                      })
                    }
                    else {
                      this.setState({
                        description: t,
                        listSuggestDescriptionCheck: this.state.listSuggestDescriptionCheck
                      })
                    }
                  }} 
                  checked={this.state.listSuggestDescriptionCheck[i]}
                  checkedIcon="dot-circle-o"
                  uncheckedIcon="circle-o">
                  <Text>{t}</Text>
                </CheckBox>
              )
            })
          }
        </View>
          <Text style={{padding: 15, fontSize: 20}}>Hình ảnh</Text>
          <ScrollView
            horizontal={true}
            style={{ padding: 10 }}> 
            { this.state.imgUris.map((l,index) => (
                <ImageInstance 
                  key={index}
                  index={index}
                  imageList={this.state.imgUris}
                  imageSource={{uri: l}} 
                  displayClose={this.state.reportFunctionsView}
                  onPressYes={() => {
                    this.state.imgUris.splice(index, 1)
                    this.setState({
                      imgUris: this.state.imgUris
                    })
                  }}/>
                ))}
          </ScrollView>
          <View style={[{ display: this.state.reportFunctionsView }, styles.reportFunctionView]}> 
            <View style={styles.cameraBtnComponent}>
              <TouchableOpacity onPress={ this._handlePressCamera }>
                <Icon name="camera" size={30} color="white" />
              </TouchableOpacity>
            </View>
            <View style={[styles.endButton, {
              backgroundColor: this.state.reportType === 1 ? GREEN : commons.RED
            }]}>
              <TouchableOpacity onPress={this._handleSubmitReport}> 
                <Text style={{color: "white", fontSize: 20, fontWeight: "bold"}}>
                  {this.state.reportType === 1 ? 
                  commons.END_TASK : 
                  commons.REPORT_PROBLEM_NAME} 
                </Text>
              </TouchableOpacity> 
              </View>
          </View>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  reportFunctionView: {
    justifyContent: "space-evenly",
    alignItems: "center",
    flexDirection: "row",
  },
  checkBoxContainer: {
    backgroundColor: 'white',
    borderWidth: 0, 
    padding: 20
  },
  container: {
    width: DEVICE_WIDTH, 
    height: DEVICE_HEIGHT,
    flex: 1
  },           
  endButton: {
    borderRadius: 20,
    margin: 2,
    padding: 10,
    width: DEVICE_WIDTH / 2 + 20,
    justifyContent: "center", 
    alignItems: "center"
  },
  cameraBtnComponent: {
    width: 50,
    height: 50,
    borderRadius: 50/2,
    backgroundColor: GREEN,
    justifyContent: "center",
    alignItems: "center",
  }, 
  textDescription: {
    marginLeft: 15,
    fontSize: 20, 
    maxWidth: DEVICE_WIDTH - 150
  }
})

const mapStateToProps = ({camera}) => {
  return {
    imageUriReport: camera.imageUriReport
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps)
(TaskSubmitReport);